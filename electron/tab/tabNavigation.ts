import { BrowserWindow } from 'electron'
import { getCurTab, webContentViewMap, createTabCore, updateCurTabBounds, isLocalFile } from './tabCore'
import { registerWebContentsEvents } from './tabEvents'
import { isUrl } from '../../src/utils'

export function updateNavigationState(tabId: string, win: BrowserWindow) {
  const tab = webContentViewMap.get(tabId)
  if (tab) {
    const canGoBack = tab.view.webContents.canGoBack()
    const canGoForward = tab.view.webContents.canGoForward()
    tab.info.canGoBack = canGoBack
    tab.info.canGoForward = canGoForward
    win.webContents.send('tab:navigation-state', { id: tabId, canGoBack, canGoForward })
  }
}

export function goBack(win: BrowserWindow) {
  const tab = getCurTab()
  if (tab?.view.webContents.canGoBack()) {
    const handler = (_event: Electron.Event, title: string) => {
      tab.view.webContents.removeListener('page-title-updated', handler)
      updateTabInfo(tab.info.id!, win, title)
    }
    tab.view.webContents.on('page-title-updated', handler)
    tab.view.webContents.goBack()
  }
}

export function goForward(win: BrowserWindow) {
  const tab = getCurTab()
  if (tab?.view.webContents.canGoForward()) {
    const handler = (_event: Electron.Event, title: string) => {
      tab.view.webContents.removeListener('page-title-updated', handler)
      updateTabInfo(tab.info.id!, win, title)
    }
    tab.view.webContents.on('page-title-updated', handler)
    tab.view.webContents.goForward()
  }
}

function isDefaultPageUrl(url: string): boolean {
  return url.includes('default.html') || url.endsWith('/default.html')
}

function getTitleForUrl(tab: { info: { url: string }, view: { webContents: { getTitle: () => string } } }, pageTitle?: string): string {
  if (isDefaultPageUrl(tab.info.url)) {
    return '新建标签页'
  }
  return pageTitle || tab.view.webContents.getTitle()
}

function updateTabInfo(tabId: string, win: BrowserWindow, title?: string) {
  const tab = webContentViewMap.get(tabId)
  if (tab) {
    const newUrl = tab.view.webContents.getURL()
    tab.info.url = newUrl
    tab.info.title = getTitleForUrl(tab, title || tab.view.webContents.getTitle())
    updateNavigationState(tabId, win)
    win.webContents.send('tab:updated', tab.info)
    if (!isLocalFile(newUrl)) {
      win.webContents.send('tab:url-changed', { id: tabId, url: newUrl })
    }
  }
}

export function refreshCurTab(win: BrowserWindow) {
  const tab = getCurTab()
  if (tab) {
    tab.view.webContents.once('did-finish-load', () => {
      if (tab.info.id) {
        const newUrl = tab.view.webContents.getURL()
        tab.info.url = newUrl
        tab.info.title = getTitleForUrl(tab)
        win.webContents.send('tab:updated', tab.info)
        if (!isLocalFile(newUrl)) {
          win.webContents.send('tab:url-changed', { id: tab.info.id, url: newUrl })
        }
      }
    })
    tab.view.webContents.reload()
  }
}

export function updateCurTabUrl(url: string, win: BrowserWindow) {
  const tab = getCurTab()
  if (tab) {
    if (isUrl(url)) {
      tab.view.webContents.loadURL(url)
    } else {
      tab.view.webContents.loadFile(url)
    }
    tab.info.url = url

    tab.view.webContents.once('page-title-updated', () => {
      tab.info.title = tab.view.webContents.getTitle()
      win.webContents.send('tab:updated', tab.info)
    })
  }
}

export function createTabAndShow(tabInfo: { title: string; url: string }, win: BrowserWindow) {
  const curTab = getCurTab()
  if (curTab?.view) {
    win.contentView.removeChildView(curTab.view)
  }

  const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo)

  if (isUrl(tabInfo.url)) {
    view.webContents.loadURL(tabInfo.url)
  } else {
    view.webContents.loadFile(tabInfo.url)
  }

  registerWebContentsEvents(view, enrichedTabInfo, win)
  win.contentView.addChildView(view)
  updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
  win.webContents.send('ipcMain:tabs:update')

  return view
}
