import { WebContentsView, shell, BrowserWindow, ipcMain } from 'electron'
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


export function createTab(tabInfo: TabInfo): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      preload: undefined,
      contextIsolation: true,
    },
  })

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

  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
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

    const _view = createTab(tabInfo)
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
    })
    win.contentView.addChildView(_view)
    updateCurTabBounds(win)

    return true
  })

  ipcMain.on('tabs:refresh', () => {
    refreshCurTab()
  })

  ipcMain.handle('tabs:switch', async (_event, tabId: string) => {
    return switchTab(tabId, win)
  })

  ipcMain.handle('tabs:close', async (_event, tabId: string) => {
    return closeTab(tabId, win)
  })
}