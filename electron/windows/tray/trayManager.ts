import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import path from 'node:path'

let tray: Tray | null = null

function getTrayIconPath(): string {
  if (!app.isPackaged) {
    return path.join(process.env.APP_ROOT!, 'build/logo.ico')
  }
  return path.join(process.resourcesPath, 'build/logo.ico')
}

export function createTray(win: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath(getTrayIconPath())
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开',
      click: () => {
        win.show()
        win.focus()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('lsq浏览器')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    win.show()
    win.focus()
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
