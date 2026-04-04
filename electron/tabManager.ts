import { BrowserWindow, WebContentsView, shell } from 'electron'

export interface TabInfo {
  title: string
  url: string
  time?: number
}

export type TabEvent = 'tabs:list'

export const tabs: TabInfo[] = []

export function createTab(win: BrowserWindow, tabInfo: TabInfo): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      preload: undefined,
      contextIsolation: true,
    },
  })

  const updateBounds = () => {
    const [width, height] = win.getContentSize()
    view.setBounds({
      x: 0,
      y: 100,
      width: width,
      height: height - 100
    })
  }

  win.on('resize', updateBounds)

  view.webContents.loadFile(tabInfo.url)
  tabs.push({
    ...tabInfo,
    time: new Date().getTime()
  })
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.contentView.addChildView(view)

  return view
}
