import { WebContentsView, BrowserWindow, ipcMain } from 'electron'
import { isUrl } from '../src/utils'
import path from 'node:path'

export interface TabInfo {
  title: string
  url: string
  time?: number
  id?: string
}

const DEFAULT_TAB = {
  title: '新建标签页',
  url: 'default.html'
}

export type TabEvent = 'tabs:list'

export const tabs: TabInfo[] = []

export let curTabId: string | null

export const webContentViewMap = new Map<string, { info: TabInfo, view: WebContentsView }>()


export function createTab(tabInfo: TabInfo, win: BrowserWindow): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      preload: undefined,
      contextIsolation: true,
    },
  })

  // 在 loadURL 之前设置 handler！
  view.webContents.setWindowOpenHandler((event) => {
    console.log('[setWindowOpenHandler] 拦截到 window.open, url:', event.url)

       // 切换到新 tab
    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    // 创建新 tab
    const popupView = createTab({
      url: event.url,
      title: '新窗口'
    }, win)

    win.contentView.addChildView(popupView)
    updateCurTabBounds(win)
    win.webContents.send('ipcMain:tabs:update')
    
    return { action: 'deny' }
  })


  if(tabInfo.title !== '新建标签页') {
     view.webContents.once('page-title-updated', () => {
      console.log('123')
      const tab = getCurTab() 
      if(!tab) return
      tab.info.title = tab.view.webContents.getTitle()
      win.webContents.send('tab:updated', tab.info)
    })
  }
 

  if(isUrl(tabInfo.url)) {
    view.webContents.loadURL(tabInfo.url)
  } else {
    view.webContents.loadFile(tabInfo.url)
  }

  const _time = new Date().getTime()
  const _id = 'id' + _time
  const _tabInfo = {
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

  return view
}


export function getCurTab() {
  return  curTabId ? webContentViewMap.get(curTabId) : null
}

export function refreshCurTab() {
  const tab = getCurTab()
  tab?.view.webContents.reload()
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

export function getTabInfoList() {
   return [...webContentViewMap.values()].map(item => item.info)
}

export function updateCurTabBounds(win: BrowserWindow) {
  const tab = getCurTab()
  if (tab?.view) {
    const [width, height] = win.getContentSize()
    tab.view.setBounds({
      x: 0,
      y: 80,
      width: width,
      height: height - 80
    })
  }
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
  updateCurTabBounds(win)

  return true
}

export function closeTab(id: string, win: BrowserWindow) {
  if (!webContentViewMap.has(id)) return false

  const tab = webContentViewMap.get(id)!
  win.contentView.removeChildView(tab.view)
  webContentViewMap.delete(id)
  tabs.splice(tabs.findIndex(t => t.id === id), 1)

  if (curTabId === id) {
    const firstTab = webContentViewMap.values().next().value
    if (firstTab) {
      switchTab(firstTab.info.id!, win)
    } else {
      curTabId = null
    }
  }

  return true
}

export function registerTabHandlers(win: BrowserWindow) {
  ipcMain.handle('tabs:list', async () => {
    return getTabInfoList()
  })

  ipcMain.handle('tabs:create', async (_event, tabInfo: { title: string; url: string }) => {
    const tab = getCurTab()
    if (tab?.view) {
      win.contentView.removeChildView(tab.view)
    }

    const _view = createTab(tabInfo, win)
    win.contentView.addChildView(_view)
    updateCurTabBounds(win)

    return true
  })

  ipcMain.handle('tabs:createDefault', async () => {
    const tab = getCurTab()
    if (tab?.view) {
      win.contentView.removeChildView(tab.view)
    }

    const _view = createTab({
      title: DEFAULT_TAB.title,
      url: path.join(process.env.APP_ROOT!, DEFAULT_TAB.url)
    }, win)
    win.contentView.addChildView(_view)
    updateCurTabBounds(win)

    return true
  })

  ipcMain.on('tabs:refresh', () => {
    refreshCurTab()
  })

  ipcMain.on('tabs:updateUrl', (_event, url: string) => {
    updateCurTabUrl(url, win)
    updateCurTabBounds(win)
  })

  ipcMain.handle('tabs:switch', async (_event, tabId: string) => {
    return switchTab(tabId, win)
  })

  ipcMain.handle('tabs:close', async (_event, tabId: string) => {
    return closeTab(tabId, win)
  })
}