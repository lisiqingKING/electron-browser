import { WebContentsView, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { setActiveTab } from '../tabsDb'
import { registerTab, unregisterTab } from './registry'
import { removeNavHistory } from './history'
import { registerWebContentsEvents } from '../tabEvents'
import { resolveAppsUrl } from '../tabNavigation'
import { isUrl } from '@renderer/utils'
import { getTabContext, getCurTab } from './context'
import { updateCurTabBounds } from './tabBounds'
import type { TabInfo } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getPreloadPath(): string {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  return isDev
    ? path.join(__dirname, '..', 'dist-electron', 'preload-app.mjs')
    : path.join(__dirname, '..', 'preload-app.mjs')
}

export function createTabCore(
  tabInfo: TabInfo,
  win: BrowserWindow,
  afterTabId?: string,
  externalId?: string,
  lazyView?: boolean
): { view: WebContentsView | null; tabInfo: TabInfo; insertIndex: number } {
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
        preload: getPreloadPath(),
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
  const view = new WebContentsView({
    webPreferences: {
      preload: getPreloadPath(),
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

export function closeTab(id: string, win: BrowserWindow): string | null {
  const ctx = getTabContext(win)
  if (!ctx.webContentViewMap.has(id)) return null

  const tab = ctx.webContentViewMap.get(id)!
  if (tab.info.isHome) return null

  if (tab.view) {
    win.contentView.removeChildView(tab.view)
    ;(tab.view.webContents as unknown as { destroy: () => void }).destroy()
  }
  ctx.webContentViewMap.delete(id)
  const closedIndex = ctx.tabs.findIndex(t => t.id === id)
  ctx.tabs.splice(closedIndex, 1)
  unregisterTab(id)
  removeNavHistory(id)

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

function resolveTabUrl(url: string): string {
  return resolveAppsUrl(url)
}
