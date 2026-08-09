import { BrowserWindow, app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const preloadPath = path.join(__dirname, 'preload.mjs')

export interface MenuItem {
  label?: string
  action?: string
  icon?: string
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

// popup webContents id -> source window id
export const popupSourceMap = new Map<number, number>()

function getPopupUrl(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL + 'popup.html'
  }
  return 'file://' + path.join(app.getAppPath(), 'dist', 'popup.html')
}

function createPopupWindow(targetWin: BrowserWindow): BrowserWindow {
  const popupWin = new BrowserWindow({
    x: targetWin.getBounds().x,
    y: targetWin.getBounds().y,
    width: targetWin.getBounds().width,
    height: targetWin.getBounds().height,
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
      preload: preloadPath,
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

  // 销毁旧 popup 窗口
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy()
    popupWindow = null
  }

  const popupWin = createPopupWindow(targetWin)
  popupWindow = popupWin

  const bounds = targetWin.getBounds()
  const popupWidth = options.width || 200
  const estimatedHeight = options.height || Math.min(
    (options.data?.items?.length || 0) * 28 + 16, 400
  )

  let popupX = options.x
  let popupY = options.y

  if (popupX + popupWidth > bounds.x + bounds.width) {
    popupX = bounds.x + bounds.width - popupWidth
  }
  if (popupY + estimatedHeight > bounds.y + bounds.height) {
    popupY = bounds.y + bounds.height - estimatedHeight
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
        x: popupX - bounds.x,
        y: popupY - bounds.y,
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