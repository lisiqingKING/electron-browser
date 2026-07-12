import { app, BrowserWindow, Menu, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createTabAndShow, registerTabHandlers, updateCurTabBounds, getCurTab } from './tab/tabHandlers'
import { initDatabase, closeDatabase } from './database/index'
import { env } from './env'
import { startSubappServer, stopSubappServer, getSubappUrl } from './subapp'
import { getDownloadManager } from './downloads/downloadManager'
import { initWebviewSource } from './downloads/sources/webviewSource'
import { registerMemoryMonitorHandler, getMemoryMonitor } from './memory/memoryMonitor'

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
  const appUrl = env.getAppUrl()
  console.log('[createWindow] 加载 app URL:', appUrl)
  createTabAndShow({
    title: '新建标签页',
    url: appUrl
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
  getMemoryMonitor().stopMonitor()
  closeDatabase()
  stopSubappServer()
  void getDownloadManager().shutdown()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  await startSubappServer()

  // 注册 lsqapp:// 协议（内部导航，不注册到系统）
  protocol.handle('lsqapp', async (request) => {
    const url = request.url // lsqapp://internal-app/settings
    const parsed = new URL(url)
    const appName = parsed.hostname // internal-app
    const route = parsed.pathname.slice(1) || '' // settings
    // lsqapp://internal-app/settings -> http://localhost:端口/internal-app/index.html#/settings
    const redirectUrl = getSubappUrl(appName, `index.html#/${route}`)
    return Response.redirect(redirectUrl, 302)
  })

  // 注册 open-lsqapp:// 协议（外部唤醒，注册到系统）
  protocol.handle('open-lsqapp', async (request) => {
    const url = request.url // open-lsqapp://open/settings
    const parsed = new URL(url)
    const target = parsed.pathname.slice(1) // open/settings
    // 直接重定向到 HTTP URL
    const redirectUrl = getSubappUrl('internal-app', `index.html#/${target}`)
    return Response.redirect(redirectUrl, 302)
  })

  initDatabase()
  initWebviewSource()
  registerMemoryMonitorHandler()
  getDownloadManager().init()
  createWindow()
  getMemoryMonitor().startMonitor()
})