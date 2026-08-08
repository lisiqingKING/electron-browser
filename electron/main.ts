import { app, BrowserWindow, Menu, protocol, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createTabAndShow, updateCurTabBounds, getCurTab } from './tabs/tabHandlers'
import { registerShortcuts } from './windows/keyboard/shortcuts'
import { registerWebContentsEvents } from './tabs/tabEvents'
import { isUrl } from '@renderer/utils'
import { tabs, curTabId, webContentViewMap, setCurTabId, createTabCore, getTabListData } from './tabs/tabCore'
import { initDatabase, closeDatabase, saveTabs, loadTabs, setActiveTab } from './shared/database/index'
import { syncFromDb as syncFavoritesFromDb } from './features/favorites/favoritesManager'
import { env } from './shared/env'
import { startSubappServer, stopSubappServer, getSubappUrl } from './subapp-server'
import { getDownloadManager } from './features/downloads/downloadManager'
import { initWebviewSource } from './features/downloads/sources/webviewSource'
import { registerMemoryMonitorHandler, getMemoryMonitor } from './shared/memory/memoryMonitor'
import { createAlertHandler } from './shared/memory/alertLogger'
import { createTray, destroyTray } from './windows/tray/trayManager'
import { registerPopupHandlers, setMainWindow } from './popup'
import { updater, updaterChannels } from './features/updater'
import { registerAllHandlers } from './bootstrap'

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
    minWidth: 800,
    minHeight: 500,
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
  const saved = loadTabs()
  if (saved.tabs.length > 0) {
    // 直接用数据库中的 ID 创建 tab，不重新生成
    for (const savedTab of saved.tabs) {
      try {
        const { view, tabInfo } = createTabCore(
          { title: savedTab.title, url: savedTab.url },
          undefined,
          savedTab.id // 使用数据库中已存在的 ID
        )
        if (isUrl(savedTab.url)) {
          view.webContents.loadURL(savedTab.url)
        } else {
          view.webContents.loadFile(savedTab.url)
        }
        registerWebContentsEvents(view, tabInfo, win)
      } catch (err) {
        console.error('[createWindow] 恢复标签失败:', savedTab.url, err)
      }
    }

    // 统一发送一次标签列表变化
    win.webContents.send('tab:list-changed', getTabListData())

    // 切换到最后活跃的标签
    if (saved.currentTabId) {
      const targetTab = webContentViewMap.get(saved.currentTabId)
      if (targetTab) {
        // 移除首页视图
        const homeTab = webContentViewMap.get(homeTabId!)
        if (homeTab?.view) win.contentView.removeChildView(homeTab.view)
        // 添加所有恢复的标签视图，最后添加目标标签使其在最上层
        for (const [id, tab] of webContentViewMap) {
          if (id !== saved.currentTabId) {
            win.contentView.addChildView(tab.view)
          }
        }
        win.contentView.addChildView(targetTab.view)
        updateCurTabBounds(targetTab, win)
        setCurTabId(saved.currentTabId)
        setActiveTab(saved.currentTabId)
        win.webContents.send('tab:current-changed', { currentTabId: saved.currentTabId })
      }
    }
  }

  // 统一在 window 层面处理 resize
  win.on('resize', () => {
    const curTab = getCurTab()
    if (curTab) updateCurTabBounds(curTab, win!)
  })

  // 注册所有 IPC handlers
  registerAllHandlers(win)

  // 注册键盘快捷键
  registerShortcuts(win)

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
  // 只保存加载成功的标签页，加载失败的页面不恢复
  const tabsToSave = tabs.filter(tab => !tab.loadError)
  saveTabs(tabsToSave, curTabId)
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

// 单例：确保只有一个实例运行
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.exit(0)
}

app.whenReady().then(async () => {
  // 第二个实例启动时，激活主窗口
  app.on('second-instance', () => {
    if (win) {
      win.show()
      win.focus()
    }
  })

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
  syncFavoritesFromDb()
  initWebviewSource()
  registerMemoryMonitorHandler()
  registerPopupHandlers()

  // 依赖注入：将日志处理器注入给内存监控
  const monitor = getMemoryMonitor()
  monitor.setAlertHandler(createAlertHandler())

  getDownloadManager().init()
  createWindow()
  monitor.startMonitor()

  // Updater
  updater.init()
  ipcMain.handle(updaterChannels.checkForUpdates, () => updater.checkForUpdates())
  ipcMain.handle(updaterChannels.downloadUpdate, () => updater.downloadUpdate())
  ipcMain.handle(updaterChannels.quitAndInstall, () => updater.quitAndInstall())
  ipcMain.handle(updaterChannels.getUpdateStatus, () => updater.getStatus())
  setTimeout(() => updater.checkForUpdates(), 1 * 60 * 1000)
})
