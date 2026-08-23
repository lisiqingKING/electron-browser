import { BrowserWindow } from 'electron'
import { mainLogger as logger } from '../shared/logger'
import { getTabContext, getCurTab, getTabListData } from './state'
import { findExistingInternalTab, switchToExistingTab } from './state/coreUtils'
import { goBack as navGoBack, goForward as navGoForward, refreshCurTab, updateCurTabUrl, createTabAndShow, resolveAppsUrl } from './tabNavigation'
import { switchTab as doSwitchTab, closeTab as doCloseTab } from './state/tabCore'
import { updateCurTabBounds } from './state/tabBounds'
import { openDevToolsForCurTab } from './state/devTools'
import { env } from '../shared/env'
import { updateTabUrl as updateTabUrlDb } from './tabsDb'

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
  const tabContext = getTabContext(win)
  const effectiveAfterTabId = afterTabId ?? tabContext.curTabId ?? undefined
  if (tabInfo.isHome) {
    return createTabAndShow(tabInfo, win, effectiveAfterTabId)
  }
  return createTabAndShow({ title: tabInfo.title, url: tabInfo.url }, win, effectiveAfterTabId)
}

export function createHomeTab(win: BrowserWindow): string | null {
  if (!win) return null
  const ctx = getTabContext(win)
  const existing = [...ctx.webContentViewMap.values()].find(t => t.info.isHome)
  if (existing) return existing.info.id ?? null

  const url = env.getAppUrl()
  logger.info('[createHome] 加载 URL:', url)
  return createTabAndShow({ title: '首页', url, isHome: true }, win)
}

export function createDefaultTab(win: BrowserWindow, afterTabId?: string): string | null {
  if (!win) return null
  const url = env.getNewTabUrl()
  logger.info('[createDefault] 加载 URL:', url)
  return createTabAndShow({ title: '新标签页', url }, win, afterTabId)
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

  logger.info(`[create${title}] 加载 URL:`, url)
  const existing = findExistingInternalTab(win, url)
  if (existing) {
    logger.info(`[create${title}] 已存在，切换到:`, existing.info.id)
    switchToExistingTab(win, existing)
    return existing.info.id || null
  }
  return createTabAndShow({ title, url }, win, afterTabId)
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
    updateTabUrlDb()
  }
}

// ============ Close ============

export function closeTab(win: BrowserWindow, tabId: string): string | null {
  if (!win) return null
  return doCloseTab(tabId, win)
}

export function reloadTab(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const tab = ctx.webContentViewMap.get(tabId)
  if (!tab || !tab.view) {
    return
  }
  tab.view.webContents.reload()
}

export function closeOtherTabs(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const closedIds = ctx.tabs.filter((t) => t.id !== tabId && !t.isHome).map((t) => t.id!)

  closedIds.forEach((id: string) => doCloseTab(id, win))
}

export function closeTabsToLeft(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const targetIndex = ctx.tabs.findIndex((t) => t.id === tabId)
  if (targetIndex === -1) return

  const closedIds = ctx.tabs.slice(0, targetIndex).filter((t) => !t.isHome).map((t) => t.id!)

  closedIds.forEach((id: string) => doCloseTab(id, win))
}

export function closeTabsToRight(win: BrowserWindow, tabId: string): void {
  if (!win) return
  const ctx = getTabContext(win)
  const targetIndex = ctx.tabs.findIndex((t) => t.id === tabId)
  if (targetIndex === -1) return

  const closedIds = ctx.tabs.slice(targetIndex + 1).filter((t) => !t.isHome).map((t) => t.id!)

  closedIds.forEach((id: string) => doCloseTab(id, win))
}

// ============ DevTools ============

export function openDevTools(win: BrowserWindow): void {
  if (!win) return
  openDevToolsForCurTab(win)
}
