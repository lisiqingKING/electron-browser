import { ipcRenderer, contextBridge } from 'electron'
import { createTabsProxy } from '../electron/tabs/ipcClient'
import { createHistoryProxy } from '../electron/features/history/ipcClient'
import { createAIConversationProxy } from '../electron/features/ai/ipcClient'
import { createDownloadsProxy } from '../electron/features/downloads/ipcClient'
import { createLogsProxy } from '../electron/features/logs/ipcClient'
import { createSettingsProxy } from '../electron/features/settings/ipcClient'
// import { createUpdaterProxy } from '../electron/features/updater/ipcClient'
import { createFavoritesProxy } from '../electron/features/favorites/ipcClient'

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
