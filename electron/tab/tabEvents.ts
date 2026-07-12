import { WebContentsView, BrowserWindow, Menu } from 'electron'
import { recordVisit } from '../history/historyManager'
import { webContentViewMap, getCurTab, TabInfo, createTabCore, updateCurTabBounds, isAppUrl } from './tabCore'
import { updateNavigationState } from './tabNavigation'
import { isUrl } from '../../src/utils'

function getTitleForUrl(tab: { info: { url: string } }, pageTitle: string): string {
  if (isAppUrl(tab.info.url)) {
    return '新建标签页'
  }
  return pageTitle
}

export function registerWebContentsEvents(view: WebContentsView, tabInfo: TabInfo, win: BrowserWindow) {
  const tabId = tabInfo.id!

  // window.open 拦截 - 内联 createTabAndShow 逻辑避免循环依赖
  view.webContents.setWindowOpenHandler((event) => {
    console.log('[setWindowOpenHandler] 拦截到 window.open, url:', event.url)

    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const { view: newView, tabInfo: newTabInfo } = createTabCore({ url: event.url, title: '新窗口' })
    if (isUrl(event.url)) {
      newView.webContents.loadURL(event.url)
    } else {
      newView.webContents.loadFile(event.url)
    }
    registerWebContentsEvents(newView, newTabInfo, win)
    win.contentView.addChildView(newView)
    updateCurTabBounds(webContentViewMap.get(newTabInfo.id!)!, win)
    win.webContents.send('tab:list-changed')

    return { action: 'deny' }
  })

  // 加载状态 - 开始
  view.webContents.on('did-start-loading', () => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      tab.info.isLoading = true
      win.webContents.send('tab:loading', { id: tabId, isLoading: true })
    }
  })

  // 加载状态 - 结束
  view.webContents.on('did-stop-loading', () => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      tab.info.isLoading = false
      win.webContents.send('tab:loading', { id: tabId, isLoading: false })
    }
  })

  // 页面加载完成
  view.webContents.on('did-finish-load', () => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      const newUrl = view.webContents.getURL()
      if (tab.info.url.startsWith('lsqapp://')) {
        // 协议 URL 不更新，显示用 url，实际加载用 actualUrl
        tab.info.actualUrl = newUrl
        // 不记录内部协议到历史记录
      } else if (!isAppUrl(tab.info.url)) {
        tab.info.url = newUrl
        tab.info.title = getTitleForUrl(tab, view.webContents.getTitle() || tab.info.title)
        recordVisit(tab.info.title, newUrl)
        win.webContents.send('tab:info-changed', tab.info)
      }
      updateNavigationState(tabId, win)
    }
  })

  // SPA 内部导航
  view.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) {
      const tab = webContentViewMap.get(tabId)
      if (tab) {
        if (tab.info.url.startsWith('lsqapp://')) {
          tab.info.actualUrl = url
        } else {
          tab.info.url = url
        }
        updateNavigationState(tabId, win)
      }
    }
  })

  // 普通导航
  view.webContents.on('did-navigate', (_event, url) => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      if (tab.info.url.startsWith('lsqapp://')) {
        tab.info.actualUrl = url
      } else {
        tab.info.url = url
        tab.info.title = getTitleForUrl(tab, view.webContents.getTitle())
      }
      win.webContents.send('tab:info-changed', tab.info)
      updateNavigationState(tabId, win)
    }
  })

  // 页面标题更新
  view.webContents.on('page-title-updated', (_event, title) => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      const newTitle = getTitleForUrl(tab, title)
      if (newTitle !== tab.info.title) {
        tab.info.title = newTitle
        win.webContents.send('tab:info-changed', tab.info)
      }
    }
  })

  // 右键菜单
  view.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    if (params.isEditable) {
      menuItems.push({ label: '剪切', role: 'cut' })
      menuItems.push({ label: '复制', role: 'copy' })
      menuItems.push({ label: '粘贴', role: 'paste' })
      menuItems.push({ type: 'separator' })
    }

    menuItems.push(
      { label: '刷新', role: 'reload' },
      { label: '开发者工具', click: () => view.webContents.openDevTools() }
    )

    const menu = Menu.buildFromTemplate(menuItems)
    menu.popup()
  })
}