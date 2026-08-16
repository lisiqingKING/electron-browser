import { BrowserWindow } from 'electron'
import { getTabContext, getCurTab, getTabListData } from './state'
import { findExistingInternalTab, switchToExistingTab } from './state/coreUtils'
import { goBack as navGoBack, goForward as navGoForward, refreshCurTab, updateCurTabUrl, createTabAndShow, resolveAppsUrl } from './tabNavigation'
import { switchTab as doSwitchTab, closeTab as doCloseTab } from './state/tabCore'
import { updateCurTabBounds } from './state/tabBounds'
import { openDevToolsForCurTab } from './state/devTools'
import { env } from '../shared/env'
import { insertTab, deleteTab, updateTabUrl as updateTabUrlDb } from './tabsDb'

export { createTabAndShow }

// ============ 内部页配置 ============

const internalPages = {
  history: { url: env.getHistoryUrl(), title: '历史记录' },
  downloads: { url: env.getDownloadsUrl(), title: '下载管理' },
  settings: { url: env.getSettingsUrl(), title: '设置' },
  logs: { url: env.getLogsUrl(), title: '日志管理' },
  ai: { url: env.getAIUrl(), title: 'AI 助手' },
  aiSaves: { url: env.getAiSavesUrl(), title: 'AI 保存记录' },
  favorites: { url: env.getFavoritesUrl(), title: '收藏夹' },
} as const

type InternalPageKey = keyof typeof internalPages

// ============ List ============

export function listTabs(win: BrowserWindow) {
  if (!win) return { tabs: [], currentTabId: null }
  return getTabListData(win)
}

// ============ Create ============

export function createTab(
  win: BrowserWindow,
  tabInfo: { title: string; url: string; isHome?: boolean },
  afterTabId?: string
): string | null {
  if (!win) return null
  // 未指定 afterTabId 时，默认插到当前标签后面
  const tabContext = getTabContext(win)
  const effectiveAfterTabId = afterTabId ?? tabContext.curTabId ?? undefined
  if (tabInfo.isHome) {
    return createTabAndShow(tabInfo, win, effectiveAfterTabId)
  }
  const time = Date.now()
  const id: string = insertTab({ title: tabInfo.title, url: tabInfo.url, time })
  return createTabAndShow({ title: tabInfo.title, url: tabInfo.url }, win, effectiveAfterTabId, id)
}

export function createHomeTab(win: BrowserWindow): string | null {
  if (!win) return null
  const ctx = getTabContext(win)
  const existing = [...ctx.webContentViewMap.values()].find(t => t.info.isHome)
  if (existing) return existing.info.id ?? null

  const url = env.getAppUrl()
  console.log('[createHome] 加载 URL:', url)
  return createTabAndShow({ title: '首页', url, isHome: true }, win)
}

export function createDefaultTab(win: BrowserWindow, afterTabId?: string): string | null {
  if (!win) return null
  const url = env.getNewTabUrl()
  console.log('[createDefault] 加载 URL:', url)
  const time = Date.now()
  const id: string = insertTab({ title: '新标签页', url, time })
  return createTabAndShow({ title: '新标签页', url }, win, afterTabId, id)
}

export function createInternalTab(
  win: BrowserWindow,
  key: InternalPageKey,
  afterTabId?: string
): string | null {
  if (!win) return null
  const page = internalPages[key]
  const url = page.url
  const title = page.title

  console.log(`[create${title}] 加载 URL:`, url)
  const existing = findExistingInternalTab(win, url)
  if (existing) {
    console.log(`[create${title}] 已存在，切换到:`, existing.info.id)
    return switchToExistingTab(win, existing)
  }
  const time = Date.now()
  const id: string = insertTab({ title, url, time })
  return createTabAndShow({ title, url }, win, afterTabId, id)
}

// ============ Switch ============

export function switchToTab(win: BrowserWindow, tabId: string): { canGoBack: boolean; canGoForward: boolean } | null {
  if (!win) return null

  doSwitchTab(tabId, win)

  const ctx = getTabContext(win)
  const targetTab = ctx.webContentViewMap.get(tabId)
  let canGoBack = false
  let canGoForward = false

  if (targetTab?.view) {
    canGoBack = targetTab.view.webContents.canGoBack()
    canGoForward = targetTab.view.webContents.canGoForward()
    targetTab.info.canGoBack = canGoBack
    targetTab.info.canGoForward = canGoForward
  }

  return { canGoBack, canGoForward }
}

// ============ Navigation ============

export function refreshTab(win: BrowserWindow): void {
  if (!win) return
  refreshCurTab(win)
}

export function goBack(win: BrowserWindow): void {
  if (!win) return
  navGoBack(win)
}

export function goForward(win: BrowserWindow): void {
  if (!win) return
  navGoForward(win)
}

export function updateUrl(win: BrowserWindow, url: string): void {
  if (!win) return
  const resolvedUrl = resolveAppsUrl(url)
  updateCurTabUrl(resolvedUrl, win)
  const ctx = getTabContext(win)
  const curTab = getCurTab(win)
  if (curTab) {
    updateCurTabBounds(ctx.webContentViewMap.get(curTab.info.id!)!, win)
    updateTabUrlDb(curTab.info.id!, resolvedUrl)
  }
}

// ============ Close ============

export function closeTab(win: BrowserWindow, tabId: string): string | null {
  if (!win) return null

  const newCurTabId = doCloseTab(tabId, win)
  deleteTab(tabId)
  return newCurTabId
}

export function reloadTab(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const tab = ctx.webContentViewMap.get(tabId)
  if (tab) {
    tab.view.webContents.reload()
  }
}

export function closeOtherTabs(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const closedIds = ctx.tabs.filter((t) => t.id !== tabId && !t.isHome).map((t) => t.id!)

  closedIds.forEach((id: string) => doCloseTab(id, win))
  closedIds.forEach((id: string) => deleteTab(id))
}

export function closeTabsToLeft(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const targetIndex = ctx.tabs.findIndex((t) => t.id === tabId)
  if (targetIndex === -1) return

  const closedIds = ctx.tabs.slice(0, targetIndex).filter((t) => !t.isHome).map((t) => t.id!)

  closedIds.forEach((id: string) => doCloseTab(id, win))
  closedIds.forEach((id: string) => deleteTab(id))
}

export function closeTabsToRight(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const targetIndex = ctx.tabs.findIndex((t) => t.id === tabId)
  if (targetIndex === -1) return

  const closedIds = ctx.tabs.slice(targetIndex + 1).filter((t) => !t.isHome).map((t) => t.id!)

  closedIds.forEach((id: string) => doCloseTab(id, win))
  closedIds.forEach((id: string) => deleteTab(id))
}

// ============ DevTools ============

export function openDevTools(win: BrowserWindow): void {
  if (!win) return
  openDevToolsForCurTab(win)
}
