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
let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win
  win.on('blur', () => {
    // popup 窗口有焦点时不关闭（用户点击了 popup）
    // 只在用户切换到其他应用时关闭
    if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isFocused()) return
    hidePopup()
  })
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function getPopupUrl(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL + 'popup.html'
  }
  return 'file://' + path.join(app.getAppPath(), 'dist', 'popup.html')
}

export function showPopup(options: PopupOptions): void {
  hidePopup()

  if (!mainWindow || mainWindow.isDestroyed()) return

  const bounds = mainWindow.getBounds()
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

  popupWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    show: false,
    transparent: true,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    }
  })

  popupWindow.loadURL(getPopupUrl())

  popupWindow.webContents.on('did-finish-load', async () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      let theme = 'dark'
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          theme = await mainWindow.webContents.executeJavaScript(
            'document.documentElement.classList.contains("dark") ? "dark" : "light"'
          )
        } catch {}
      }

      popupWindow.webContents.send('popup:render', {
        type: options.type,
        data: options.data,
        context: options.context,
        theme,
        x: popupX - bounds.x,
        y: popupY - bounds.y,
        width: popupWidth,
        height: estimatedHeight,
      })
      popupWindow.showInactive()
    }
  })

  popupWindow.on('closed', () => {
    popupWindow = null
  })
}

export function hidePopup(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
  }
}
