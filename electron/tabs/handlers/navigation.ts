import { WebContentsView, BrowserWindow } from 'electron'
import { getTabContext } from '../state'
import { isAppUrl, isInternalUrl, getDomainFromUrl, getTitleForInternalUrl, getTitleForUrl, clearCrashTitle } from '../state/coreUtils'
import { updateNavigationState, tryRestoreLoadError } from '../tabNavigation'
import { recordVisit } from '../../modules/history/manager'
import { updateTabUrl } from '../tabsDb'
import { PROTOCOL_LSQAPP } from '../../shared/env'

export function registerNavigationHandlers(
  view: WebContentsView,
  tabId: string,
  ctx: ReturnType<typeof getTabContext>,
  safeSend: (channel: string, ...args: any[]) => void,
  win: BrowserWindow
) {
  view.webContents.on('did-start-loading', () => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab) return

    tab.info.isLoading = true
    safeSend('tab:loading', { id: tabId, isLoading: true })

    let newTitle: string | null = null
    if (isInternalUrl(tab.info.url)) {
      newTitle = getTitleForInternalUrl(tab.info.url)
    } else if (!isAppUrl(tab.info.url)) {
      newTitle = getDomainFromUrl(tab.info.url)
    }

    if (newTitle && newTitle !== tab.info.title) {
      tab.info.title = newTitle
      safeSend('tab:info-changed', tab.info)
    }
  })

  view.webContents.on('did-stop-loading', () => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      tab.info.isLoading = false
      safeSend('tab:loading', { id: tabId, isLoading: false })
    }
  })

  view.webContents.on('did-finish-load', () => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab) return

    const newUrl = view.webContents.getURL()

    if (tryRestoreLoadError(tab, newUrl)) {
      safeSend('tab:info-changed', tab.info)
      updateNavigationState(tabId, win)
      return
    }

    if (tab.info.loadError) {
      updateNavigationState(tabId, win)
      return
    }

    if (tab.info.url.startsWith(`${PROTOCOL_LSQAPP}://`)) {
      tab.info.actualUrl = newUrl
    } else if (!isAppUrl(tab.info.url)) {
      tab.info.url = newUrl
      tab.info.title = clearCrashTitle(getTitleForUrl(tab, view.webContents.getTitle() || tab.info.title))
      recordVisit(tab.info.title, newUrl, tab.info.favicon)
      updateTabUrl()
      safeSend('tab:info-changed', tab.info)
    }
    updateNavigationState(tabId, win)
  })

  view.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (!isMainFrame) return
    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab) return
    if (tab.info.loadError) return

    if (tab.info.url.startsWith(`${PROTOCOL_LSQAPP}://`)) {
      tab.info.actualUrl = url
    } else {
      tab.info.url = url
    }
    updateNavigationState(tabId, win)
  })

  view.webContents.on('did-navigate', (_event, url) => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab) return

    if (tryRestoreLoadError(tab, url)) {
      safeSend('tab:info-changed', tab.info)
      updateNavigationState(tabId, win)
      return
    }

    if (tab.info.loadError) return

    if (tab.info.url.startsWith(`${PROTOCOL_LSQAPP}://`)) {
      tab.info.actualUrl = url
    } else {
      tab.info.url = url
      tab.info.title = clearCrashTitle(getTitleForUrl(tab, view.webContents.getTitle()))
    }
    safeSend('tab:info-changed', tab.info)
    updateNavigationState(tabId, win)
  })

  view.webContents.on('page-title-updated', (_event, title) => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab || tab.info.loadError) return

    const newTitle = getTitleForUrl(tab, title)
    if (newTitle !== tab.info.title) {
      tab.info.title = newTitle
      safeSend('tab:info-changed', tab.info)
    }
  })
}
