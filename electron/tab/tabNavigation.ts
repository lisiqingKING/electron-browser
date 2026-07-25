import { BrowserWindow } from 'electron'
import { getCurTab, webContentViewMap, createTabCore, updateCurTabBounds, isAppUrl, isInternalUrl, getDomainFromUrl, getTitleForInternalUrl, getTabListData } from './tabCore'
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

// 检测 URL 是否是错误页面 URL，如果是则恢复 loadError 状态（会修改 tab.info）
export function tryRestoreLoadError(tab: { info: TabInfo }, newUrl: string): boolean {
  if (tab.info.loadError || !newUrl.includes('/error?url=')) return false
  try {
    const hashPart = newUrl.split('#')[1] || ''
    const queryString = hashPart.split('?')[1] || ''
    const params = new URLSearchParams(queryString)
    const failedUrl = params.get('url') || ''
    const errorCode = parseInt(params.get('code') || '') || -1
    const errorDesc = params.get('error') || ''

    if (failedUrl) {
      tab.info.loadError = { url: failedUrl, code: errorCode, message: errorDesc }
      tab.info.url = failedUrl
      tab.info.title = getDomainFromUrl(failedUrl) || failedUrl
      return true
    }
  } catch {}
  return false
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
    const newUrl = tab.view.webContents.getURL()

    // 检测是否是错误页面 URL，恢复 loadError 状态
    if (tryRestoreLoadError(tab, newUrl)) {
      win.webContents.send('tab:info-changed', tab.info)
      updateNavigationState(tab.info.id!, win)
      return
    }

    // 正常页面，清除加载错误状态
    tab.info.loadError = undefined
    tab.info.url = newUrl
    tab.info.actualUrl = newUrl
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
    const newUrl = tab.view.webContents.getURL()

    // 检测是否是错误页面 URL，恢复 loadError 状态
    if (tryRestoreLoadError(tab, newUrl)) {
      win.webContents.send('tab:info-changed', tab.info)
      updateNavigationState(tab.info.id!, win)
      return
    }

    // 正常页面，清除加载错误状态
    tab.info.loadError = undefined
    tab.info.url = newUrl
    tab.info.actualUrl = newUrl
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
    // 如果有加载错误，重新加载原始 URL 而不是当前页面
    const urlToLoad = tab.info.loadError ? tab.info.loadError.url : null

    tab.view.webContents.once('did-finish-load', () => {
      if (tab.info.id) {
        // 如果 loadError 仍然存在，说明原始 URL 再次加载失败，不更新 URL
        if (tab.info.loadError) {
          updateNavigationState(tab.info.id, win)
          return
        }

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

    if (urlToLoad) {
      // 有加载错误时，用 location.replace 加载原始 URL（不添加新历史记录）
      const safeUrl = urlToLoad.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      tab.view.webContents.executeJavaScript(`location.replace('${safeUrl}')`)
    } else {
      tab.view.webContents.reload()
    }
  }
}

export function updateCurTabUrl(url: string, win: BrowserWindow) {
  const tab = getCurTab()
  if (tab) {
    // 用户通过URL栏主动输入时，清除之前的加载错误状态
    tab.info.loadError = undefined

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
    // page-title-updated 由 tabEvents.ts 统一处理
  }
}

export function createTabAndShow(tabInfo: { title: string; url: string; isHome?: boolean }, win: BrowserWindow, afterTabId?: string) {
  // 如果没有指定 afterTabId，默认在当前标签后面创建
  const finalAfterTabId = afterTabId || getCurTab()?.info.id

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

  const { view, tabInfo: enrichedTabInfo, insertIndex } = createTabCore({ ...tabInfo, title }, finalAfterTabId)
  enrichedTabInfo.isLoading = true

  // 解析 apps:// 协议
  const resolvedUrl = resolveAppsUrl(tabInfo.url) || tabInfo.url
  if (isUrl(resolvedUrl)) {
    view.webContents.loadURL(resolvedUrl)
  } else {
    view.webContents.loadFile(resolvedUrl)
  }

  registerWebContentsEvents(view, enrichedTabInfo, win)
  // 在指定位置插入视图
  win.contentView.addChildView(view, insertIndex)
  updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
  win.webContents.send('tab:list-changed', getTabListData())
  win.webContents.send('tab:loading', { id: enrichedTabInfo.id, isLoading: true })

  return enrichedTabInfo.id
}