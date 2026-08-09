import { Tray, Menu, app, nativeImage } from 'electron'
import path from 'node:path'

let tray: Tray | null = null

function getTrayIconPath(): string {
  if (!app.isPackaged) {
    return path.join(process.env.APP_ROOT!, 'build/logo.ico')
  }
  return path.join(process.resourcesPath, 'build/logo.ico')
}

function buildTrayMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '退出应用',
      click: () => {
        app.quit()
      }
    }
  ]

  return Menu.buildFromTemplate(template)
}

export function createTray(): Tray {
  const icon = nativeImage.createFromPath(getTrayIconPath())
  tray = new Tray(icon)

  tray.setToolTip('lsq浏览器')
  tray.setContextMenu(buildTrayMenu())

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
