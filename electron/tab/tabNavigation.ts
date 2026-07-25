import { BrowserWindow } from 'electron'
import { getCurTab, webContentViewMap, createTabCore, updateCurTabBounds, isAppUrl, isInternalUrl, getDomainFromUrl, getTitleForInternalUrl } from './tabCore'
import { registerWebContentsEvents } from './tabEvents'
import { isUrl } from '../../src/utils'
import { getSubappUrl } from '../subapp'

export function resolveAppsUrl(url: string): string | null {
  if (!url.startsWith('apps://')) return null
  try {
    const parsed = new URL(url)
    const subapp = parsed.hostname
    const route = parsed.pathname || '/'
    const fullPath = route === '/' ? '' : route
    return getSubappUrl(subapp, `index.html#${fullPath}`)
  } catch {
    return null
  }
}

export function updateNavigationState(tabId: string, win: BrowserWindow) {
  const tab = webContentViewMap.get(tabId)
  if (tab) {
    const canGoBack = tab.view.webContents.canGoBack()
    const canGoForward = tab.view.webContents.canGoForward()
    tab.info.canGoBack = canGoBack
    tab.info.canGoForward = canGoForward
    console.log('[updateNavigationState] sending tab:can-navigate', { id: tabId, canGoBack, canGoForward })
    win.webContents.send('tab:can-navigate', { id: tabId, canGoBack, canGoForward })
  }
}

export function goBack(win: BrowserWindow) {
  const tab = getCurTab()
  if (!tab) {
    console.log('[goBack] no current tab')
    return
  }

  const canGoBack = tab.view.webContents.canGoBack()
  console.log('[goBack] canGoBack:', canGoBack)

  if (!canGoBack) {
    console.log('[goBack] no back history in browser')
    return
  }

  // 监听导航完成，导航完成后自动更新 URL
  const finishHandler = () => {
    console.log('[goBack] navigation finished, newUrl:', tab.view.webContents.getURL())
    tab.info.url = tab.view.webContents.getURL()
    tab.info.actualUrl = tab.info.url
    win.webContents.send('tab:info-changed', tab.info)
    updateNavigationState(tab.info.id!, win)
  }

  // 同时监听 did-navigate 和 did-navigate-in-page（SPA 客户端路由）
  tab.view.webContents.once('did-navigate', finishHandler)
  tab.view.webContents.once('did-navigate-in-page', finishHandler)
  tab.view.webContents.goBack()
}

export function goForward(win: BrowserWindow) {
  const tab = getCurTab()
  if (!tab) {
    console.log('[goForward] no current tab')
    return
  }

  const canGoForward = tab.view.webContents.canGoForward()
  console.log('[goForward] canGoForward:', canGoForward)

  if (!canGoForward) {
    console.log('[goForward] no forward history in browser')
    return
  }

  // 监听导航完成，导航完成后自动更新 URL
  const finishHandler = () => {
    console.log('[goForward] navigation finished, newUrl:', tab.view.webContents.getURL())
    tab.info.url = tab.view.webContents.getURL()
    tab.info.actualUrl = tab.info.url
    win.webContents.send('tab:info-changed', tab.info)
    updateNavigationState(tab.info.id!, win)
  }

  // 同时监听 did-navigate 和 did-navigate-in-page（SPA 客户端路由）
  tab.view.webContents.once('did-navigate', finishHandler)
  tab.view.webContents.once('did-navigate-in-page', finishHandler)
  tab.view.webContents.goForward()
}

function getTitleForUrl(tab: { info: { url: string }, view: { webContents: { getTitle: () => string } } }, pageTitle?: string): string {
  if (isAppUrl(tab.info.url)) {
    const webTitle = tab.view.webContents.getTitle()
    return webTitle || '新建标签页'
  }
  return pageTitle || tab.view.webContents.getTitle()
}

export function refreshCurTab(win: BrowserWindow) {
  const tab = getCurTab()
  if (tab) {
    tab.view.webContents.once('did-finish-load', () => {
      if (tab.info.id) {
        const newUrl = tab.view.webContents.getURL()
        if (tab.info.url.startsWith('lsqapp://')) {
          tab.info.actualUrl = newUrl
        } else {
          tab.info.url = newUrl
          tab.info.title = getTitleForUrl(tab)
        }
        win.webContents.send('tab:info-changed', tab.info)
      }
    })
    tab.view.webContents.reload()
  }
}

export function updateCurTabUrl(url: string, win: BrowserWindow) {
  const tab = getCurTab()
  if (tab) {
    // 先设置 URL，再加载，确保 did-start-loading 触发时 URL 已更新
    tab.info.url = url

    // 立即设置加载中的标题
    let newTitle: string | null = null
    if (isInternalUrl(url)) {
      newTitle = getTitleForInternalUrl(url)
    } else if (!isAppUrl(url)) {
      newTitle = getDomainFromUrl(url)
    }
    if (newTitle) {
      tab.info.title = newTitle
    }
    win.webContents.send('tab:info-changed', tab.info)

    if (isUrl(url)) {
      tab.view.webContents.loadURL(url)
    } else {
      tab.view.webContents.loadFile(url)
    }

    // isLoading 由 did-start-loading / did-stop-loading 事件统一管理

    tab.view.webContents.once('page-title-updated', () => {
      tab.info.title = tab.view.webContents.getTitle()
      win.webContents.send('tab:info-changed', tab.info)
    })
  }
}

export function createTabAndShow(tabInfo: { title: string; url: string; isHome?: boolean }, win: BrowserWindow) {
  const curTab = getCurTab()
  if (curTab?.view) {
    win.contentView.removeChildView(curTab.view)
  }

  // 根据 URL 设置标题（如果传入的标题为空）
  let title = tabInfo.title
  if (!title) {
    if (isInternalUrl(tabInfo.url)) {
      title = getTitleForInternalUrl(tabInfo.url) || '首页'
    } else if (!isAppUrl(tabInfo.url)) {
      title = getDomainFromUrl(tabInfo.url) || '新建标签页'
    } else {
      title = '首页'
    }
  }

  const { view, tabInfo: enrichedTabInfo } = createTabCore({ ...tabInfo, title })
  enrichedTabInfo.isLoading = true

  // 解析 apps:// 协议
  const resolvedUrl = resolveAppsUrl(tabInfo.url) || tabInfo.url
  if (isUrl(resolvedUrl)) {
    view.webContents.loadURL(resolvedUrl)
  } else {
    view.webContents.loadFile(resolvedUrl)
  }

  registerWebContentsEvents(view, enrichedTabInfo, win)
  win.contentView.addChildView(view)
  updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
  win.webContents.send('tab:list-changed')
  win.webContents.send('tab:loading', { id: enrichedTabInfo.id, isLoading: true })

  return enrichedTabInfo.id
}