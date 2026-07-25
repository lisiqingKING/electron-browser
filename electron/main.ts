import { app, BrowserWindow, Menu, protocol, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createTabAndShow, registerTabHandlers, updateCurTabBounds, getCurTab } from './tab/tabHandlers'
import { tabs, curTabId, webContentViewMap, setCurTabId } from './tab/tabCore'
import { initDatabase, closeDatabase, saveTabs, loadTabs } from './database/index'
import { env } from './env'
import { startSubappServer, stopSubappServer, getSubappUrl } from './subapp'
import { getDownloadManager } from './downloads/downloadManager'
import { initWebviewSource } from './downloads/sources/webviewSource'
import { registerMemoryMonitorHandler, getMemoryMonitor } from './memory/memoryMonitor'
import { createAlertHandler } from './memory/alertLogger'
import { createTray, destroyTray } from './tray/trayManager'
import { registerPopupHandlers, setMainWindow } from './popup'

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
    frame: false,
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

  // 创建首页标签页（常驻不可关闭）
  const appUrl = env.getAppUrl()
  console.log('[createWindow] 加载 app URL:', appUrl)
  const homeTabId = createTabAndShow({
    title: '首页',
    url: appUrl,
    isHome: true
  }, win)

  // 恢复上次保存的标签
  const saved = loadTabs(env.getAppUrl())
  if (saved.tabs.length > 0) {
    const idMap = new Map<string, string>() // savedId → newId

    for (const savedTab of saved.tabs) {
      try {
        const newId = createTabAndShow({ title: savedTab.title, url: savedTab.url }, win)
        if (newId) idMap.set(savedTab.id, newId)
      } catch (err) {
        console.error('[createWindow] 恢复标签失败:', savedTab.url, err)
      }
    }

    // 切换到最后活跃的标签
    const targetNewId = idMap.get(saved.currentTabId!)
    if (targetNewId) {
      const targetTab = webContentViewMap.get(targetNewId)
      if (targetTab) {
        const homeTab = webContentViewMap.get(homeTabId!)
        if (homeTab?.view) win.contentView.removeChildView(homeTab.view)
        win.contentView.addChildView(targetTab.view)
        updateCurTabBounds(targetTab, win)
        setCurTabId(targetNewId)
        win.webContents.send('tab:current-changed', { currentTabId: targetNewId })
      }
    }
  }

  // 统一在 window 层面处理 resize
  win.on('resize', () => {
    const curTab = getCurTab()
    if (curTab) updateCurTabBounds(curTab, win!)
  })

  // 注册 tab 相关 handlers
  registerTabHandlers(win)

  // 最大化状态变化时通知渲染进程
  win.on('maximize', () => {
    win?.webContents.send('window:maximize-changed', true)
  })
  win.on('unmaximize', () => {
    win?.webContents.send('window:maximize-changed', false)
  })

  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }

  createTray(win)
  setMainWindow(win)
}

app.on('window-all-closed', () => {
  // 不自动退出，让托盘保持应用运行
})

app.on('before-quit', () => {
  saveTabs(tabs, curTabId)
})

app.on('will-quit', () => {
  destroyTray()
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

  // 窗口控制 IPC（全局注册，不依赖具体窗口）
  ipcMain.handle('window:minimize', () => win?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.handle('window:close', () => win?.hide())
  ipcMain.handle('window:isMaximized', () => win?.isMaximized() ?? false)

  initDatabase()
  initWebviewSource()
  registerMemoryMonitorHandler()
  registerPopupHandlers()

  // 依赖注入：将日志处理器注入给内存监控
  const monitor = getMemoryMonitor()
  monitor.setAlertHandler(createAlertHandler())

  getDownloadManager().init()
  createWindow()
  monitor.startMonitor()
})