import { BrowserWindow } from 'electron'
import path from 'node:path'

export let popupWindow: BrowserWindow | null = null

function getPreloadPath(): string {
  return path.join(process.env.APP_ROOT!, 'dist-electron', 'preload.js')
}

export function createPopupWindow(targetWin: BrowserWindow): BrowserWindow {
  const contentBounds = targetWin.getContentBounds()
  const popupWin = new BrowserWindow({
    x: contentBounds.x,
    y: contentBounds.y,
    width: contentBounds.width,
    height: contentBounds.height,
    frame: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
    }
  })

  popupWin.on('blur', () => {
    try {
      if (!popupWin.isDestroyed()) {
        popupWin.destroy()
      }
    } catch (e) {
      console.warn('[PopupWindow] blur destroy error:', e)
    }
  })

  popupWin.on('closed', () => {
    if (popupWindow === popupWin) {
      popupWindow = null
    }
  })

  popupWindow = popupWin
  return popupWin
}

export function destroyPopupWindow(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy()
  }
  popupWindow = null
}

export function showPopupInactive(popupWin: BrowserWindow): void {
  popupWin.showInactive()
}

export function sendRenderData(
  popupWin: BrowserWindow,
  data: { component: string; props: unknown; context: unknown; theme: string; x: number; y: number; width: number; height: number; windowId: number }
): void {
  popupWin.webContents.send('popup:render', data)
}
