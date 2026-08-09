import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import path from 'node:path'
import { getAllWindows } from '../../modules/windowManager'

let tray: Tray | null = null

function getTrayIconPath(): string {
  if (!app.isPackaged) {
    return path.join(process.env.APP_ROOT!, 'build/logo.ico')
  }
  return path.join(process.resourcesPath, 'build/logo.ico')
}

function buildTrayMenu() {
  const windows = getAllWindows()

  const windowItems: Electron.MenuItemConstructorOptions[] = windows.map((win, index) => ({
    label: `窗口 ${index + 1}`,
    click: () => {
      win.show()
      win.focus()
    }
  }))

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '打开主窗口',
      click: () => {
        if (windows.length > 0) {
          windows[0].show()
          windows[0].focus()
        }
      }
    },
    { type: 'separator' },
    ...windowItems,
    { type: 'separator' },
    {
      label: '显示所有窗口',
      click: () => {
        for (const win of windows) {
          win.show()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ]

  return Menu.buildFromTemplate(template)
}

export function createTray(win: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath(getTrayIconPath())
  tray = new Tray(icon)

  tray.setToolTip('lsq浏览器')
  tray.setContextMenu(buildTrayMenu())

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

export function rebuildTrayMenu(): void {
  if (tray) {
    tray.setContextMenu(buildTrayMenu())
  }
}
