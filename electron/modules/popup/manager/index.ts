import { BrowserWindow, app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface MenuItem {
  label?: string
  icon?: string
  action?: string
  type?: string
  disabled?: boolean
  separator?: boolean
  children?: MenuItem[]
}

export interface PopupOptions {
  x: number
  y: number
  type: 'menu' | string
  data: any
  width?: number
  height?: number
  context?: any
}

let popupWindow: BrowserWindow | null = null

export const popupSourceMap = new Map<number, number>()

function getPopupUrl(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL + 'popup.html'
  }
  return 'file://' + path.join(app.getAppPath(), 'dist', 'popup.html')
}

function getPreloadPath(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return path.join(app.getAppPath(), 'dist-electron', 'preload.js')
  }
  return path.join(app.getAppPath(), 'dist-electron', 'popup-preload.js')
}

function createPopupWindow(targetWin: BrowserWindow): BrowserWindow {
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

export function showPopup(options: PopupOptions, win: BrowserWindow): void {
  const targetWin = win
  if (!targetWin || targetWin.isDestroyed()) return

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy()
    popupWindow = null
  }

  const popupWin = createPopupWindow(targetWin)
  popupWindow = popupWin

  const contentBounds = targetWin.getContentBounds()
  const popupWidth = options.width || 200
  const estimatedHeight = options.height || Math.min(
    (options.data?.items?.length || 0) * 28 + 16, 400
  )

  let popupX = options.x
  let popupY = options.y

  if (popupX + popupWidth > contentBounds.x + contentBounds.width) {
    popupX = contentBounds.x + contentBounds.width - popupWidth
  }
  if (popupY + estimatedHeight > contentBounds.y + contentBounds.height) {
    popupY = contentBounds.y + contentBounds.height - estimatedHeight
  }

  popupWin.loadURL(getPopupUrl())

  popupSourceMap.set(popupWin.webContents.id, targetWin.id)

  const currentPopupId = popupWin.id
  popupWin.webContents.on('did-finish-load', async () => {
    if (!popupWin.isDestroyed() && popupWin.id === currentPopupId) {
      let theme = 'dark'
      if (targetWin && !targetWin.isDestroyed()) {
        try {
          theme = await targetWin.webContents.executeJavaScript(
            'document.documentElement.classList.contains("dark") ? "dark" : "light"'
          )
        } catch {}
      }

      popupWin.webContents.send('popup:render', {
        type: options.type,
        data: options.data,
        context: options.context,
        theme,
        x: popupX - contentBounds.x,
        y: popupY - contentBounds.y,
        width: popupWidth,
        height: estimatedHeight,
      })

      popupWin.showInactive()
    }
  })
}

export function hidePopup(): void {
  if (!popupWindow) return
  try {
    if (popupWindow.isDestroyed()) {
      popupWindow = null
      return
    }
    popupWindow.webContents.send('popup:hide')
    popupWindow.hide()
  } catch {
    popupWindow = null
  }
}