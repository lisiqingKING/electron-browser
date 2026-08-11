import { BrowserWindow, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTabListData, cleanupWindowContext, createTabCore, destroyAllTabViews } from '../tabs/state'
import { cleanupWindowTabs } from '../tabs/state/windowTabs'
import { env } from '../shared/env'
import { setupWindow } from '../mainEntry/windowEvents'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function getAppRoot() {
  return process.env.APP_ROOT!
}

export const MAIN_DIST = () => path.join(getAppRoot(), 'dist-electron')
export const RENDERER_DIST = () => path.join(getAppRoot(), 'dist')
export const VITE_PUBLIC = () => VITE_DEV_SERVER_URL ? path.join(getAppRoot(), 'public') : RENDERER_DIST()

let reserveWindow: BrowserWindow | null = null
let currentMainWindow: BrowserWindow | null = null

const allWindows = new Set<BrowserWindow>()

export function getAllWindows(): BrowserWindow[] {
  return [...allWindows]
}

function createWindowCore(): BrowserWindow {
  Menu.setApplicationMenu(null)

  const win = new BrowserWindow({
    icon: path.join(VITE_PUBLIC(), 'electron-vite.svg'),
    frame: false,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  })

  allWindows.add(win)
  win.on('closed', () => {
    allWindows.delete(win)
    cleanupWindowContext(win)
    cleanupWindowTabs(win.id)
  })

  // 创建 lazy home tab（视图等到切换 tab 时才创建）
  createTabCore({ title: '首页', url: env.getAppUrl(), isHome: true }, win, undefined, undefined, true)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + (VITE_DEV_SERVER_URL.includes('?') ? '&' : '?') + `windowId=${win.id}`)
  } else {
    win.loadFile(path.join(RENDERER_DIST(), 'index.html'), { query: { windowId: String(win.id) } })
  }

  // 主进程推送初始 tab 列表（渲染进程 mount 后注册好 listener）
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('tab:list-changed', getTabListData(win))
  })

  win.on('maximize', () => {
    win.webContents.send('window:maximize-changed', true)
  })
  win.on('unmaximize', () => {
    win.webContents.send('window:maximize-changed', false)
  })

  return win
}

export function createWindow(options?: { show?: boolean; tabInfo?: unknown }): BrowserWindow {
  const show = options?.show ?? true
  const win = createWindowCore()
  if (!show) {
    win.hide()
  }
  return win
}

export function ensureReserveWindow(): void {
  if (!reserveWindow || reserveWindow.isDestroyed()) {
    reserveWindow = createWindowCore()
    setupWindow(reserveWindow)
    reserveWindow.hide()
  }
}

export function activateReserveWindow(): BrowserWindow {
  if (!reserveWindow || reserveWindow.isDestroyed()) {
    ensureReserveWindow()
  }

  const win = reserveWindow!
  reserveWindow = null

  if (win.isDestroyed()) {
    console.error('[activateReserveWindow] window destroyed')
    return win
  }

  win.show()
  win.focus()
  setWindowAsCurrentMain(win)

  ensureReserveWindow()
  return win
}

export function setWindowAsCurrentMain(win: BrowserWindow): void {
  currentMainWindow = win
}

export function closeWindow(win: BrowserWindow): void {
  destroyAllTabViews(win)
  win.destroy()

  if (currentMainWindow === win) {
    const otherWin = [...allWindows].find(w => !w.isDestroyed())
    if (otherWin) {
      setWindowAsCurrentMain(otherWin)
    }
  }
}

export function showAllWindows(): void {
  for (const w of allWindows) {
    w.show()
  }
}
