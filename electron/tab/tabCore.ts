import { WebContentsView, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { env } from '../env'
import { setActiveTab } from '../database/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface TabInfo {
  title: string
  url: string           // 协议 URL，用于显示
  actualUrl?: string    // 真实加载的 URL
  time?: number
  id?: string
  wcId?: number         // webContents id，用于匹配渲染进程内存数据
  canGoBack?: boolean
  canGoForward?: boolean
  isLoading?: boolean
  favicon?: string      // 网页 favicon URL
  isHome?: boolean      // 首页 tab，不可关闭
  loadError?: {         // 页面加载错误信息
    url: string
    code: number
    message: string
  }
}

export interface TabHistoryEntry {
  url: string       // 协议 URL（用于显示）
  actualUrl: string // 真实 URL（用于加载）
}

export interface TabHistory {
  entries: TabHistoryEntry[]
  currentIndex: number
}

export const tabHistoryMap = new Map<string, TabHistory>()

export function pushHistory(tabId: string, url: string, actualUrl: string) {
  let history = tabHistoryMap.get(tabId)
  if (!history) {
    history = { entries: [], currentIndex: -1 }
    tabHistoryMap.set(tabId, history)
  }
  // 清除当前 index 之后的历史（访问新页面时）
  history.entries = history.entries.slice(0, history.currentIndex + 1)
  history.entries.push({ url, actualUrl })
  history.currentIndex = history.entries.length - 1
}

export function goBackInHistory(tabId: string): TabHistoryEntry | null {
  const history = tabHistoryMap.get(tabId)
  if (!history || history.currentIndex <= 0) return null
  history.currentIndex--
  return history.entries[history.currentIndex]
}

export function goForwardInHistory(tabId: string): TabHistoryEntry | null {
  const history = tabHistoryMap.get(tabId)
  if (!history || history.currentIndex >= history.entries.length - 1) return null
  history.currentIndex++
  return history.entries[history.currentIndex]
}

export function canGoBackInHistory(tabId: string): boolean {
  const history = tabHistoryMap.get(tabId)
  return !!history && history.currentIndex > 0
}

export function canGoForwardInHistory(tabId: string): boolean {
  const history = tabHistoryMap.get(tabId)
  return !!history && history.currentIndex < history.entries.length - 1
}

export function removeHistory(tabId: string) {
  tabHistoryMap.delete(tabId)
}

const DEFAULT_TAB = {
  title: '首页',
  get url() { return env.getAppUrl() }
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
  return tabs
    .map(tab => webContentViewMap.get(tab.id!)?.info)
    .filter((info): info is TabInfo => info !== undefined)
}

export function getTabListData() {
  return {
    tabs: getTabInfoList(),
    currentTabId: curTabId
  }
}

export function createTabCore(tabInfo: TabInfo, afterTabId?: string): { view: WebContentsView; tabInfo: TabInfo; insertIndex: number } {
  // All webview tabs use preload-app.mjs which exposes bridge API
  // In dev mode, __dirname is electron/, in prod it's dist-electron/
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

  const _time = new Date().getTime()
  const _id = 'id' + _time

  const _tabInfo: TabInfo = {
    ...tabInfo,
    time: _time,
    id: _id,
    wcId: view.webContents.id
  }

  // 计算插入位置：在 afterTabId 后面，如果没有指定则追加到末尾
  let insertIndex = tabs.length
  if (afterTabId) {
    const afterIndex = tabs.findIndex(t => t.id === afterTabId)
    if (afterIndex !== -1) {
      insertIndex = afterIndex + 1
    }
  }

  tabs.splice(insertIndex, 0, _tabInfo)
  curTabId = _id
  webContentViewMap.set(_id, {
    info: _tabInfo,
    view
  })

  return { view, tabInfo: _tabInfo, insertIndex }
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
  setActiveTab(id)

  return true
}

export function closeTab(id: string, win: BrowserWindow): string | null {
  if (!webContentViewMap.has(id)) return null

  const tab = webContentViewMap.get(id)!
  if (tab.info.isHome) return null  // 首页不可关闭
  win.contentView.removeChildView(tab.view)
  ;(tab.view.webContents as any).destroy()  // 彻底销毁渲染进程，否则音频/视频会继续播放
  webContentViewMap.delete(id)
  const closedIndex = tabs.findIndex(t => t.id === id)
  tabs.splice(closedIndex, 1)
  removeHistory(id)

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
    y: 96,
    width,
    height: height - 96
  })
}

export function openDevToolsForTab(tabId: string) {
  const tab = webContentViewMap.get(tabId)
  if (tab) {
    tab.view.webContents.openDevTools()
  }
}

export function openDevToolsForCurTab() {
  const tab = getCurTab()
  if (tab) {
    tab.view.webContents.openDevTools()
  }
}

export function isAppUrl(url: string): boolean {
  const devUrl = env.getAppUrl()
  return url.includes(devUrl) || url.includes('localhost') || url.includes('../app/index.html')
}

export function getDomainFromUrl(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol === 'file:' || !hostname) {
      return '本地文件'
    }
    return hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// 内部子应用页面标题映射
const INTERNAL_PAGE_TITLES: Record<string, string> = {
  '': '首页',
  'default': '首页',
  'newtab': '新标签页',
  'ai': 'AI 助手',
  'ai-saves': 'AI 保存记录',
  'history': '历史记录',
  'downloads': '下载管理',
  'logs': '日志查看',
}

export function isInternalUrl(url: string): boolean {
  return url.startsWith('lsqapp://') || url.startsWith(env.getAppUrl())
}

export function isInternalTab(tab: { info: { url: string; actualUrl?: string } }): boolean {
  const url = tab.info.actualUrl || tab.info.url
  return isInternalUrl(url) || isAppUrl(url)
}

// 查找已存在的内部页面标签
export function findExistingInternalTab(url: string) {
  return [...webContentViewMap.values()].find(t => {
    const tabUrl = t.info.url
    // 精确匹配
    if (tabUrl === url) return true
    // 提取路由部分比较（处理 dev/prod URL 差异）
    const getRoute = (u: string) => {
      const hashIndex = u.indexOf('#/')
      return hashIndex !== -1 ? u.slice(hashIndex) : u
    }
    return getRoute(tabUrl) === getRoute(url)
  })
}

// 切换到已存在的标签（内部页面专用）
export function switchToExistingTab(win: BrowserWindow, existing: { info: TabInfo; view: WebContentsView }) {
  const curTab = getCurTab()
  if (curTab?.view) win.contentView.removeChildView(curTab.view)
  win.contentView.addChildView(existing.view)
  updateCurTabBounds(existing, win)
  setCurTabId(existing.info.id!)

  // 发送导航状态
  const canGoBack = existing.view.webContents.canGoBack()
  const canGoForward = existing.view.webContents.canGoForward()
  existing.info.canGoBack = canGoBack
  existing.info.canGoForward = canGoForward
  win.webContents.send('tab:can-navigate', { id: existing.info.id!, canGoBack, canGoForward })
  win.webContents.send('tab:current-changed', { currentTabId: existing.info.id })

  return existing.info.id!
}

export function getTitleForInternalUrl(url: string): string | null {
  if (!isInternalUrl(url)) return null
  try {
    const parsed = new URL(url)
    // lsqapp:// URLs have route in pathname (e.g., /ai), http:// URLs have route in hash (e.g., #/ai)
    let route: string
    if (parsed.hash && parsed.hash !== '#/') {
      route = parsed.hash.replace('#/', '')
    } else {
      route = parsed.pathname.slice(1) || ''
    }
    return INTERNAL_PAGE_TITLES[route] || null
  } catch {
    return null
  }
}

export { DEFAULT_TAB }