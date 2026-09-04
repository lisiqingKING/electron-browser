import { ipcRenderer, contextBridge } from 'electron'
import { createTabsProxy } from './tabs/ipcClient'
import { createWindowProxy } from './modules/window/ipcClient'
import { createClipboardProxy } from './modules/clipboard/ipcClient'
import { createFavoritesProxy } from './modules/favorites/ipcClient'
import { createSettingsProxy } from './modules/settings/ipcClient'
import { createDownloadsProxy } from './modules/downloads/ipcClient'
import { createSuggestionsProxy } from './modules/suggestions/ipcClient'
import { createPopupProxy } from './modules/popup/ipcClient'

// Parse windowId from URL
const url = new URL(window.location.href)
const windowId = url.searchParams.get('windowId')

// 模块注册表
const moduleRegistry: Record<string, () => Record<string, Function>> = {
  tabs: () => createTabsProxy(ipcRenderer),
  window: () => createWindowProxy(),
  clipboard: () => createClipboardProxy(),
  favorites: () => createFavoritesProxy(),
  settings: () => createSettingsProxy(),
  downloads: () => createDownloadsProxy(),
  suggestions: () => createSuggestionsProxy(),
  popup: () => createPopupProxy(),
}

// 构建所有模块
const allModules: Record<string, Record<string, Function>> = {}
for (const [name, factory] of Object.entries(moduleRegistry)) {
  allModules[name] = factory()
}

// 通用事件订阅（转发到底层 ipcRenderer）
// 渲染进程使用 window.bridge.on('channel', callback) 而非 window.ipcRenderer.on('channel', callback)
const eventListeners = new Map<string, Set<Function>>()

function ensureIpcListener(channel: string) {
  if (!eventListeners.has(channel)) {
    eventListeners.set(channel, new Set())
    // channel 名通过闭包捕获，args 是主进程发来的数据
    ipcRenderer.on(channel, (_event, ...args) => {
      const listeners = eventListeners.get(channel)
      if (listeners) {
        listeners.forEach(fn => fn(...args))
      }
    })
  }
}

// 暴露 bridge API
contextBridge.exposeInMainWorld('bridge', {
  windowId: windowId ? parseInt(windowId, 10) : null,

  // 按需获取模块
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

  // 通用事件订阅（统一 channel 隐藏）
  on(channel: string, fn: Function) {
    ensureIpcListener(channel)
    eventListeners.get(channel)!.add(fn)
  },

  off(channel: string, fn: Function) {
    const listeners = eventListeners.get(channel)
    if (listeners) {
      listeners.delete(fn)
      if (listeners.size === 0) {
        // 移除该 channel 的匿名监听器（通过重新创建来引用）
        ipcRenderer.removeAllListeners(channel)
        eventListeners.delete(channel)
      }
    }
  },

  // send 方法
  send(channel: string, ...args: unknown[]) {
    ipcRenderer.send(channel, ...args)
  },
})

// popup 关闭由 preload 直接处理
ipcRenderer.on('popup:hide', () => {
  window.close()
})