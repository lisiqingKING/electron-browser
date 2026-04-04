import { BrowserWindow, WebContentsView, shell } from 'electron'

export interface TabInfo {
  title: string
  url: string
}

export function createTab(win: BrowserWindow): WebContentsView {
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

  view.webContents.loadFile('home.html')
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.contentView.addChildView(view)

  return view
}
