import { ipcRenderer, contextBridge } from 'electron'
import { createTabsProxy, tabsChannels } from '../electron/tabs/ipcClient'
import { createWindowProxy, windowChannels } from '../electron/modules/window/ipcClient'
import { createAIConversationProxy, aiChannels } from '../electron/modules/ai/ipcClient'
import { createAssistantProxy, assistantChannels } from '../electron/modules/assistant/ipcClient'
import { createNotesProxy, notesChannels } from '../electron/modules/notes/ipcClient'
import { createWorkspaceProxy, workspaceChannels } from '../electron/modules/workspace/ipcClient'
import { createSearchProxy, searchChannels } from '../electron/modules/search/ipcClient'
import { createDownloadsProxy, downloadsChannels } from '../electron/modules/downloads/ipcClient'
import { createLogsProxy } from '../electron/modules/logs/ipcClient'
import { createSettingsProxy, settingsChannels } from '../electron/modules/settings/ipcClient'
import { createFavoritesProxy, favoritesChannels } from '../electron/modules/favorites/ipcClient'
import { createSuggestionsProxy } from '../electron/modules/suggestions/ipcClient'
import { createUtilsProxy } from '../electron/modules/utils/ipcClient'
import { createPopupProxy, popupChannels } from '../electron/modules/popup/ipcClient'
import { createWallpaperProxy, wallpaperChannels } from '../electron/modules/wallpaper/ipcClient'
import { tabChannels, mainChannels } from '../electron/shared/channels'
import { createProxy } from '../electron/shared/autoIpc'

// 简单模块的 proxy 定义（只用于 createProxy，不包含实际实现）
// 实际实现在主进程的 clipboardModule/historyModule
const clipboardProxyDef = {
  readText: () => {},
  writeText: (_text: string) => {},
}

const historyProxyDef = {
  get: () => [],
  clear: () => true,
  delete: (_id: number) => {},
}

// Parse windowId from URL
const url = new URL(window.location.href)
const windowId = url.searchParams.get('windowId')

// AI 模块 proxy（流式订阅方法已封装，渲染进程无需接触 ai:stream channel）
const aiProxy = createAIConversationProxy()

// 模块注册表
const moduleRegistry: Record<string, () => Record<string, Function>> = {
  tabs: () => createTabsProxy(ipcRenderer),
  window: () => createWindowProxy(),
  clipboard: () => createProxy('clipboard', clipboardProxyDef, ipcRenderer),
  history: () => createProxy('history', historyProxyDef, ipcRenderer),
  ai: () => aiProxy,
  assistant: () => createAssistantProxy(),
  notes: () => createNotesProxy(),
  workspace: () => createWorkspaceProxy(),
  search: () => createSearchProxy(),
  downloads: () => createDownloadsProxy(),
  logs: () => createLogsProxy(ipcRenderer),
  settings: () => createSettingsProxy(),
  favorites: () => createFavoritesProxy(),
  suggestions: () => createSuggestionsProxy(),
  utils: () => createUtilsProxy(),
  popup: () => createPopupProxy(),
  wallpaper: () => createWallpaperProxy(),
}

// 构建所有模块
const allModules: Record<string, Record<string, Function>> = {}
for (const [name, factory] of Object.entries(moduleRegistry)) {
  allModules[name] = factory()
}

// 通用事件订阅（转发到底层 ipcRenderer）
const eventListeners = new Map<string, Set<Function>>()

function ensureIpcListener(channel: string) {
  if (!eventListeners.has(channel)) {
    eventListeners.set(channel, new Set())
    ipcRenderer.on(channel, (_event, ...args) => {
      const listeners = eventListeners.get(channel)
      if (listeners) {
        listeners.forEach(fn => fn(...args))
      }
    })
  }
}

// 渲染进程 JS 错误收集，发送到主进程写入 render/ 日志
const logsProxy = createLogsProxy(ipcRenderer)

window.onerror = (message, source, lineno, colno, error) => {
  logsProxy.renderError({
    message: String(message),
    stack: error?.stack,
    url: source,
    line: lineno,
  })
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  logsProxy.renderError({
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})

// 暴露 bridge API
contextBridge.exposeInMainWorld('bridge', {
  windowId: windowId ? parseInt(windowId, 10) : null,

  // 暴露 channel 常量供渲染进程使用
  channels: {
    tabs: tabsChannels,
    window: windowChannels,
    ai: aiChannels,
    assistant: assistantChannels,
    notes: notesChannels,
    workspace: workspaceChannels,
    search: searchChannels,
    downloads: downloadsChannels,
    settings: settingsChannels,
    favorites: favoritesChannels,
    popup: popupChannels,
    wallpaper: wallpaperChannels,
    tab: tabChannels,
    main: mainChannels,
  },

  // 直接访问 AI 模块（推荐方式）
  ai: aiProxy,

  // Utils 模块
  getUtils() {
    return createUtilsProxy()
  },

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
    return () => this.off(channel, fn)
  },

  off(channel: string, fn: Function) {
    const listeners = eventListeners.get(channel)
    if (listeners) {
      listeners.delete(fn)
      if (listeners.size === 0) {
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
ipcRenderer.on(popupChannels.hide, () => {
  window.close()
})
