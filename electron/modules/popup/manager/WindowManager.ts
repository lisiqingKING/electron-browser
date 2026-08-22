import { BrowserWindow } from 'electron'
import path from 'node:path'

export const popupSourceMap = new Map<number, number>()

let popupWindow: BrowserWindow | null = null

export function setPopupWindow(win: BrowserWindow): void {
  popupWindow = win
}

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
    } catch {}
  })

  popupWin.on('closed', () => {
    try {
      popupSourceMap.delete(popupWin.webContents.id)
    } catch {}
    if (popupWindow === popupWin) {
      popupWindow = null
    }
  })

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

export function hidePopupWindow(): void {
  if (!popupWindow) return
  try {
    if (popupWindow.isDestroyed()) {
      popupWindow = null
      return
    }
    popupWindow.destroy()
  } catch {
    popupWindow = null
  } finally {
    popupWindow = null
  }
}

export function sendRenderData(
  popupWin: BrowserWindow,
  data: { component: string; props: unknown; context: unknown; theme: string; x: number; y: number; width: number; height: number; windowId: number }
): void {
  popupWin.webContents.send('popup:render', data)
}
