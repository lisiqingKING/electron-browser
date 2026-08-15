import { ipcRenderer, contextBridge } from 'electron'
import { createTabsProxy } from '../electron/tabs/ipcClient'
import { createHistoryProxy } from '../electron/modules/history/ipcClient'
import { createAIConversationProxy } from '../electron/modules/ai/ipcClient'
import { createDownloadsProxy } from '../electron/modules/downloads/ipcClient'
import { createLogsProxy } from '../electron/modules/logs/ipcClient'
import { createSettingsProxy } from '../electron/modules/settings/ipcClient'
// import { createUpdaterProxy } from '../electron/modules/updater/ipcClient'
import { createFavoritesProxy } from '../electron/modules/favorites/ipcClient'

// 模块注册表 - 可以动态添加新模块
const moduleRegistry: Record<string, () => Record<string, Function>> = {
  tabs: () => createTabsProxy(ipcRenderer),
  history: () => createHistoryProxy(ipcRenderer),
  ai: () => createAIConversationProxy(ipcRenderer),
  downloads: () => createDownloadsProxy(ipcRenderer),
  logs: () => createLogsProxy(ipcRenderer),
  settings: () => createSettingsProxy(ipcRenderer),
  // updater: () => createUpdaterProxy(ipcRenderer),
  favorites: () => createFavoritesProxy(ipcRenderer),
}

// 构建所有模块
const allModules: Record<string, Record<string, Function>> = {}
for (const [name, factory] of Object.entries(moduleRegistry)) {
  allModules[name] = factory()
}

// 渲染进程 JS 错误收集，发送到主进程写入 render/ 日志
const logsProxy = createLogsProxy(ipcRenderer)

// 全局未捕获错误
window.onerror = (message, source, lineno, colno, error) => {
  logsProxy.renderError({
    message: String(message),
    stack: error?.stack,
    url: source,
    line: lineno,
  })
}

// 未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  logsProxy.renderError({
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})

// 暴露 bridge API
contextBridge.exposeInMainWorld('bridge', {
  getModules(moduleNames?: string[]) {
    if (!moduleNames || moduleNames.length === 0) {
      return allModules
    }
    const result: Record<string, Record<string, Function>> = {}
    for (const name of moduleNames) {
      if (allModules[name]) {
        result[name] = allModules[name]
      }
    }
    return result
  },

  // 获取所有模块名称
  getModuleNames() {
    return Object.keys(moduleRegistry)
  },

  // 订阅主进程推送事件 (镜像 preload.ts 的 ipcRenderer.on/off)
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
    return ipcRenderer.on(channel, listener)
  },

  off(channel: string, listener: (...args: any[]) => void) {
    return ipcRenderer.off(channel, listener)
  }
})
