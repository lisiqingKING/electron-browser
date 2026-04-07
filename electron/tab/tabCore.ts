import { WebContentsView, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface TabInfo {
  title: string
  url: string
  time?: number
  id?: string
  canGoBack?: boolean
  canGoForward?: boolean
  isLoading?: boolean
}

const DEFAULT_TAB = {
  title: '新建标签页',
  url: 'default.html'
}

export const tabs: TabInfo[] = []

export let curTabId: string | null

export const webContentViewMap = new Map<string, { info: TabInfo, view: WebContentsView }>()

export function getCurTab() {
  return curTabId ? webContentViewMap.get(curTabId) : null
}

export function setCurTabId(id: string) {
  curTabId = id
}

export function getTabInfoList() {
  return [...webContentViewMap.values()].map(item => item.info)
}

export function createTabCore(tabInfo: TabInfo): { view: WebContentsView; tabInfo: TabInfo } {
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
    },
  })

  const _time = new Date().getTime()
  const _id = 'id' + _time

  const _tabInfo: TabInfo = {
    ...tabInfo,
    time: _time,
    id: _id
  }

  tabs.push(_tabInfo)
  curTabId = _id
  webContentViewMap.set(_id, {
    info: _tabInfo,
    view
  })

  return { view, tabInfo: _tabInfo }
}

export function isLocalFile(url: string): boolean {
  return !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')
}

export function switchTab(id: string, win: BrowserWindow) {
  if (!webContentViewMap.has(id)) return false

  const curTab = getCurTab()
  if (curTab?.view) {
    win.contentView.removeChildView(curTab.view)
  }

  curTabId = id
  const targetTab = webContentViewMap.get(id)!
  win.contentView.addChildView(targetTab.view)
  updateCurTabBounds(targetTab, win)

  return true
}

export function closeTab(id: string, win: BrowserWindow): string | null {
  if (!webContentViewMap.has(id)) return null

  const tab = webContentViewMap.get(id)!
  win.contentView.removeChildView(tab.view)
  webContentViewMap.delete(id)
  const closedIndex = tabs.findIndex(t => t.id === id)
  tabs.splice(closedIndex, 1)

  let newCurTabId: string | null = null
  if (curTabId === id) {
    // 优先切换到前一个 tab，如果不存在则切换到后一个
    const targetIndex = closedIndex > 0 ? closedIndex - 1 : 0
    const targetTab = tabs[targetIndex]
    if (targetTab?.id) {
      switchTab(targetTab.id, win)
      newCurTabId = targetTab.id
    } else {
      curTabId = null
    }
  }

  return newCurTabId
}

export function updateCurTabBounds(tab: { info: TabInfo, view: WebContentsView }, win: BrowserWindow) {
  const [width, height] = win.getContentSize()
  tab.view.setBounds({
    x: 0,
    y: 80,
    width,
    height: height - 80
  })
}

export { DEFAULT_TAB }
