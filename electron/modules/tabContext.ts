import { WebContentsView, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { setActiveTab } from '../features/tabs/tabsDb'
import { registerTab, unregisterTab } from './tabRegistry'
import { registerWebContentsEvents } from '../tabs/tabEvents'
import { getSubappUrl } from '../subapp-server'
import { isUrl } from '@renderer/utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface TabInfo {
  title: string
  url: string
  actualUrl?: string
  time?: number
  id?: string
  wcId?: number
  canGoBack?: boolean
  canGoForward?: boolean
  isLoading?: boolean
  favicon?: string
  isHome?: boolean
  loadError?: {
    url: string
    code: number
    message: string
  }
}

export interface TabContext {
  tabs: TabInfo[]
  curTabId: string | null
  webContentViewMap: Map<string, { info: TabInfo; view: WebContentsView }>
}

// Map from BrowserWindow.id to TabContext
const windowTabContexts = new Map<number, TabContext>()

export function getTabContext(win: BrowserWindow): TabContext {
  const existing = windowTabContexts.get(win.id)
  if (existing) return existing

  const ctx: TabContext = {
    tabs: [],
    curTabId: null,
    webContentViewMap: new Map()
  }
  windowTabContexts.set(win.id, ctx)
  return ctx
}

export function getCurTab(win: BrowserWindow) {
  const ctx = getTabContext(win)
  return ctx.curTabId ? ctx.webContentViewMap.get(ctx.curTabId) : null
}

export function setCurTabId(id: string, win: BrowserWindow) {
  getTabContext(win).curTabId = id
}

export function getTabListData(win: BrowserWindow) {
  const ctx = getTabContext(win)
  return {
    tabs: ctx.tabs.map(t => ctx.webContentViewMap.get(t.id!)?.info).filter(Boolean),
    currentTabId: ctx.curTabId
  }
}

export function createTabCore(
  tabInfo: TabInfo,
  win: BrowserWindow,
  afterTabId?: string,
  externalId?: string,
  lazyView?: boolean
): { view: WebContentsView | null; tabInfo: TabInfo; insertIndex: number } {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const preloadPath = isDev
    ? path.join(__dirname, '..', 'dist-electron', 'preload-app.mjs')
    : path.join(__dirname, 'preload-app.mjs')

  const ctx = getTabContext(win)
  const _time = new Date().getTime()
  const _id = externalId || `tab-${randomUUID()}`

  const _tabInfo: TabInfo = {
    ...tabInfo,
    time: _time,
    id: _id,
    wcId: undefined
  }

  let insertIndex = ctx.tabs.length
  if (afterTabId) {
    const afterIndex = ctx.tabs.findIndex(t => t.id === afterTabId)
    if (afterIndex !== -1) {
      insertIndex = afterIndex + 1
    }
  }

  let view: WebContentsView | null = null

  if (!lazyView) {
    view = new WebContentsView({
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
      },
    })
    _tabInfo.wcId = view.webContents.id
  }

  ctx.tabs.splice(insertIndex, 0, _tabInfo)
  ctx.curTabId = _id
  ctx.webContentViewMap.set(_id, { info: _tabInfo, view: view as WebContentsView })

  if (view) {
    registerTab(_id, { tabInfo: _tabInfo, view, browserWindow: win })
  }

  return { view, tabInfo: _tabInfo, insertIndex }
}

export function createTabView(tabInfo: TabInfo, win: BrowserWindow): WebContentsView {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const preloadPath = isDev
    ? path.join(__dirname, '..', 'dist-electron', 'preload-app.mjs')
    : path.join(__dirname, 'preload-app.mjs')

  const view = new WebContentsView({
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  })

  const ctx = getTabContext(win)
  tabInfo.wcId = view.webContents.id
  const entry = ctx.webContentViewMap.get(tabInfo.id!)
  if (entry) {
    entry.view = view
  }
  registerTab(tabInfo.id!, { tabInfo, view, browserWindow: win })

  return view
}

export function switchTab(id: string, win: BrowserWindow): boolean {
  const ctx = getTabContext(win)
  if (!ctx.webContentViewMap.has(id)) return false

  const curTab = getCurTab(win)
  if (curTab?.view) {
    win.contentView.removeChildView(curTab.view)
  }

  ctx.curTabId = id
  const targetTab = ctx.webContentViewMap.get(id)!

  // Lazy view: 如果 tab 还没有视图，创建它
  if (!targetTab.view) {
    const view = createTabView(targetTab.info, win)
    registerWebContentsEvents(view, targetTab.info, win)
    const resolvedUrl = resolveTabUrl(targetTab.info.url)
    if (isUrl(resolvedUrl)) {
      view.webContents.loadURL(resolvedUrl)
    } else {
      view.webContents.loadFile(resolvedUrl)
    }
    win.contentView.addChildView(view)
    updateCurTabBounds(targetTab, win)
  } else {
    win.contentView.addChildView(targetTab.view)
    updateCurTabBounds(targetTab, win)
  }

  setActiveTab(id)

  return true
}

function resolveTabUrl(url: string): string {
  if (url.startsWith('apps://')) {
    try {
      const parsed = new URL(url)
      const subapp = parsed.hostname
      const route = parsed.pathname || '/'
      const fullPath = route === '/' ? '' : route
      return getSubappUrl(subapp, `index.html#${fullPath}`)
    } catch {
      return url
    }
  }
  return url
}

export function closeTab(id: string, win: BrowserWindow): string | null {
  const ctx = getTabContext(win)
  if (!ctx.webContentViewMap.has(id)) return null

  const tab = ctx.webContentViewMap.get(id)!
  if (tab.info.isHome) return null

  // Lazy view 可能没有视图
  if (tab.view) {
    win.contentView.removeChildView(tab.view)
    // WebContents 类型未暴露 destroy()，需要断言
    ;(tab.view.webContents as unknown as { destroy: () => void }).destroy()
  }
  ctx.webContentViewMap.delete(id)
  const closedIndex = ctx.tabs.findIndex(t => t.id === id)
  ctx.tabs.splice(closedIndex, 1)
  unregisterTab(id)

  if (ctx.curTabId === id) {
    const targetIndex = closedIndex > 0 ? closedIndex - 1 : 0
    const targetTab = ctx.tabs[targetIndex]
    if (targetTab?.id) {
      switchTab(targetTab.id, win)
      return targetTab.id
    }
    ctx.curTabId = null
  }

  return null
}

export function updateCurTabBounds(
  tab: { info: TabInfo; view: WebContentsView },
  win: BrowserWindow
) {
  const [width, height] = win.getContentSize()
  tab.view.setBounds({
    x: 0,
    y: 96,
    width,
    height: height - 96
  })
}

export function openDevToolsForTab(tabId: string, win: BrowserWindow) {
  const ctx = getTabContext(win)
  const tab = ctx.webContentViewMap.get(tabId)
  if (tab?.view) {
    tab.view.webContents.openDevTools()
  }
}

export function openDevToolsForCurTab(win: BrowserWindow) {
  const tab = getCurTab(win)
  if (tab?.view) {
    tab.view.webContents.openDevTools()
  }
}

export function cleanupWindowContext(win: BrowserWindow): void {
  windowTabContexts.delete(win.id)
}
