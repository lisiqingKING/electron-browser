import { BrowserWindow, Menu, app } from 'electron'
import path from 'node:path'
import { getTabListData, cleanupWindowContext, createTabCore, destroyAllTabViews, getTabContext } from '../tabs/state'
import { cleanupWindowTabs } from '../tabs/state/windowTabs'
import { env } from '../shared/env'
import { setupWindow } from '../mainEntry/windowEvents'
import { mainLogger as logger } from '../shared/logger'
import { saveTabs } from '../tabs/tabsDb'
import { destroyTray } from './tray/trayManager'

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function getAppRoot() {
  return process.env.APP_ROOT!
}

export const MAIN_DIST = () => path.join(getAppRoot(), 'dist-electron')
export const RENDERER_DIST = () => path.join(getAppRoot(), 'dist')
export const VITE_PUBLIC = () => VITE_DEV_SERVER_URL ? path.join(getAppRoot(), 'public') : RENDERER_DIST()

let reserveWindow: BrowserWindow | null = null
let currentMainWindow: BrowserWindow | null = null
let pendingWindowPosition: { x: number; y: number } | null = null

const allWindows = new Set<BrowserWindow>()

export function getAllWindows(): BrowserWindow[] {
  return [...allWindows]
}

function createWindowCore(isMain = false): BrowserWindow {
  Menu.setApplicationMenu(null)

  const win = new BrowserWindow({
    icon: path.join(VITE_PUBLIC(), 'electron-vite.svg'),
    frame: false,
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 500,
    show: false,
    webPreferences: {
      preload: path.join(MAIN_DIST(), 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  })

  if (isMain) {
    win.webContents.once('did-finish-load', () => {
      win.show()
      win.webContents.send('main:ready-for-popup')
    })
  }
  ;(win as any).isMainWindow = isMain

  allWindows.add(win)
  win.on('close', () => {
    saveTabs(getTabContext(win).tabs)
  })
  win.on('closed', () => {
    allWindows.delete(win)
    cleanupWindowContext(win)
    cleanupWindowTabs(win.id)
  })

  // 创建 lazy home tab（视图等到切换 tab 时才创建）
  createTabCore({ title: '首页', url: env.getAppUrl(), isHome: true }, win, undefined, undefined, true)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + (VITE_DEV_SERVER_URL.includes('?') ? '&' : '?') + `windowId=${win.id}&isMain=${isMain}`)
  } else {
    win.loadFile(path.join(RENDERER_DIST(), 'index.html'), { query: { windowId: String(win.id), isMain: String(isMain) } })
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

export function createWindow(options?: { show?: boolean; tabInfo?: unknown; isMain?: boolean }): BrowserWindow {
  const show = options?.show ?? true
  const isMain = options?.isMain ?? false
  const win = createWindowCore(isMain)
  if (!show) {
    win.hide()
  }
  return win
}

export function ensureReserveWindow(): void {
  if (!reserveWindow || reserveWindow.isDestroyed()) {
    reserveWindow = createWindowCore(false)
    setupWindow(reserveWindow)
    reserveWindow.hide()
  }
}

export function activateReserveWindow(show = true): BrowserWindow {
  if (!reserveWindow || reserveWindow.isDestroyed()) {
    ensureReserveWindow()
  }

  const win = reserveWindow!
  reserveWindow = null

  if (win.isDestroyed()) {
    logger.error('window destroyed')
    return win
  }

  ;(win as any).isMainWindow = true
  // show() 之前设置位置，避免 setPosition 触发 autoresize
  if (pendingWindowPosition) {
    win.setPosition(pendingWindowPosition.x, pendingWindowPosition.y)
    pendingWindowPosition = null
  }

  if (show) {
    win.show()
    win.setAlwaysOnTop(false, 'normal')
    win.focus()
    setWindowAsCurrentMain(win)
  }

  ensureReserveWindow()
  return win
}

export function setReserveWindowPosition(x: number, y: number) {
  pendingWindowPosition = { x, y }
}

export function setWindowAsCurrentMain(win: BrowserWindow): void {
  currentMainWindow = win
}

export function closeReserveWindow(): void {
  if (reserveWindow && !reserveWindow.isDestroyed()) {
    reserveWindow.destroy()
    reserveWindow = null
  }
}

export function closeWindow(win: BrowserWindow): void {
  destroyAllTabViews(win)

  const visibleCount = BrowserWindow.getAllWindows()
    .filter(w => !w.isDestroyed() && w.isVisible() && w !== win)
    .length

  if (visibleCount === 0) {
    closeReserveWindow()
    destroyTray()
    app.quit()
  } else {
    win.destroy()
    if (currentMainWindow === win) {
      const otherWin = [...allWindows].find(w => !w.isDestroyed())
      if (otherWin) {
        setWindowAsCurrentMain(otherWin)
      }
    }
  }
}

export function showAllWindows(): void {
  for (const w of allWindows) {
    w.show()
  }
}
