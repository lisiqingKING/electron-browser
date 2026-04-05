import { app, BrowserWindow, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createTabAndShow, registerTabHandlers, updateCurTabBounds, getCurTab } from './tab/tabHandlers'
import { initDatabase, closeDatabase } from './database/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  Menu.setApplicationMenu(null)

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // 创建初始标签页
  createTabAndShow({
    title: '新建标签页',
    url: path.join(process.env.APP_ROOT, 'default.html')
  }, win)

  // 统一在 window 层面处理 resize
  win.on('resize', () => {
    const curTab = getCurTab()
    if (curTab) updateCurTabBounds(curTab, win!)
  })

  // 注册 tab 相关 handlers
  registerTabHandlers(win)

  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initDatabase()
  createWindow()
})
