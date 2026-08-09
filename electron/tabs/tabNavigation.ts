import { BrowserWindow } from 'electron'
import { getCurTab, createTabCore, updateCurTabBounds, getTabListData, getTabContext, switchTab, TabInfo } from './state'
import { isAppUrl, isInternalUrl, getDomainFromUrl, getTitleForInternalUrl, escapeForJsString } from './state/coreUtils'
import { registerWebContentsEvents } from './tabEvents'
import { isUrl } from '@renderer/utils'
import { getSubappUrl } from '../subapp-server'
import { PROTOCOL_LSQAPP } from '../shared/env'

export function resolveAppsUrl(url: string): string {
  if (!url.startsWith('apps://')) return url
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

export function updateNavigationState(tabId: string, win: BrowserWindow) {
  const ctx = getTabContext(win)
  const tab = ctx.webContentViewMap.get(tabId)
  if (tab) {
    const canGoBack = tab.view.webContents.canGoBack()
    const canGoForward = tab.view.webContents.canGoForward()
    tab.info.canGoBack = canGoBack
    tab.info.canGoForward = canGoForward
    win.webContents.send('tab:can-navigate', { id: tabId, canGoBack, canGoForward })
  }
}

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
  const tab = getCurTab(win)
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

  const finishHandler = () => {
    console.log('[goBack] navigation finished, newUrl:', tab.view.webContents.getURL())
    const newUrl = tab.view.webContents.getURL()

    if (tryRestoreLoadError(tab, newUrl)) {
      win.webContents.send('tab:info-changed', tab.info)
      updateNavigationState(tab.info.id!, win)
      return
    }

    tab.info.loadError = undefined
    tab.info.url = newUrl
    tab.info.actualUrl = newUrl
    win.webContents.send('tab:info-changed', tab.info)
    updateNavigationState(tab.info.id!, win)
  }

  tab.view.webContents.once('did-navigate', finishHandler)
  tab.view.webContents.once('did-navigate-in-page', finishHandler)
  tab.view.webContents.goBack()
}

export function goForward(win: BrowserWindow) {
  const tab = getCurTab(win)
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

  const finishHandler = () => {
    console.log('[goForward] navigation finished, newUrl:', tab.view.webContents.getURL())
    const newUrl = tab.view.webContents.getURL()

    if (tryRestoreLoadError(tab, newUrl)) {
      win.webContents.send('tab:info-changed', tab.info)
      updateNavigationState(tab.info.id!, win)
      return
    }

    tab.info.loadError = undefined
    tab.info.url = newUrl
    tab.info.actualUrl = newUrl
    win.webContents.send('tab:info-changed', tab.info)
    updateNavigationState(tab.info.id!, win)
  }

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
  const tab = getCurTab(win)
  if (tab) {
    const urlToLoad = tab.info.loadError ? tab.info.loadError.url : null

    tab.view.webContents.once('did-finish-load', () => {
      if (tab.info.id) {
        if (tab.info.loadError) {
          updateNavigationState(tab.info.id, win)
          return
        }

        const newUrl = tab.view.webContents.getURL()
        if (tab.info.url.startsWith(`${PROTOCOL_LSQAPP}://`)) {
          tab.info.actualUrl = newUrl
        } else {
          tab.info.url = newUrl
          tab.info.title = getTitleForUrl(tab)
        }
        win.webContents.send('tab:info-changed', tab.info)
      }
    })

    if (urlToLoad) {
      tab.view.webContents.executeJavaScript(`location.replace('${escapeForJsString(urlToLoad)}')`)
    } else {
      tab.view.webContents.reload()
    }
  }
}

export function updateCurTabUrl(url: string, win: BrowserWindow) {
  const tab = getCurTab(win)
  if (tab) {
    tab.info.loadError = undefined
    tab.info.url = url

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
  }
}

export function createTabAndShow(tabInfo: { title: string; url: string; isHome?: boolean }, win: BrowserWindow, afterTabId?: string, externalId?: string): string | null {
  const ctx = getTabContext(win)

  // 如果是 home tab 且已存在 lazy home tab，直接切换到它
  if (tabInfo.isHome) {
    const existingHomeTab = ctx.tabs.find(t => t.isHome && t.id !== externalId)
    if (existingHomeTab?.id) {
      switchTab(existingHomeTab.id, win)
      return existingHomeTab.id
    }
  }

  const curTab = getCurTab(win)
  if (curTab?.view) {
    win.contentView.removeChildView(curTab.view)
  }

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

  const { view, tabInfo: enrichedTabInfo, insertIndex } = createTabCore({ ...tabInfo, title }, win, afterTabId, externalId)
  if (!view) {
    return null
  }
  enrichedTabInfo.isLoading = true

  const resolvedUrl = resolveAppsUrl(tabInfo.url)
  if (isUrl(resolvedUrl)) {
    view.webContents.loadURL(resolvedUrl)
  } else {
    view.webContents.loadFile(resolvedUrl)
  }

  registerWebContentsEvents(view, enrichedTabInfo, win)
  win.contentView.addChildView(view, insertIndex)
  updateCurTabBounds(ctx.webContentViewMap.get(enrichedTabInfo.id!)!, win)
  win.webContents.send('tab:list-changed', getTabListData(win))
  win.webContents.send('tab:loading', { id: enrichedTabInfo.id, isLoading: true })

  return enrichedTabInfo.id ?? null
}
