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

// ── 工具函数 ──────────────────────────────────────────────
const TAB_ICON_MAP: Record<string, string> = {
  'star': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  'link': 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  'default': 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  'newtab': 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  'ai': 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z',
  'ai-saves': 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  'history': 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  'downloads': 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  'logs': 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  'settings': 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  'error': 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
}

function getRouteFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'lsqapp:') {
      const pathParts = parsed.pathname.split('/').filter(Boolean)
      return pathParts.length > 1 ? pathParts.slice(1).join('/') : null
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      if (parsed.hash) {
        return parsed.hash.replace('#/', '') || null
      }
      return null
    }
    return null
  } catch {
    return null
  }
}

function getTabIcon(route: string | null): string | null {
  if (!route) return null
  return TAB_ICON_MAP[route] ?? null
}

function getInternalIconFromUrl(url: string): string | null {
  return getTabIcon(getRouteFromUrl(url))
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

  // 工具函数
  getUtils() {
    return {
      getInternalIconFromUrl,
    }
  },

  // 订阅主进程推送事件 (镜像 preload.ts 的 ipcRenderer.on/off)
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
    return ipcRenderer.on(channel, listener)
  },

  off(channel: string, listener: (...args: any[]) => void) {
    return ipcRenderer.off(channel, listener)
  }
})

// 注入脚本（webviewSource）和设置页需要调用的 channel
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel: string, ...args: any[]) => {
    const allowed = [
      'downloads:direct-download-url',
      'blob-download:write',
      'blob-download:error',
      'window:getDownloadDir',
      'window:selectDownloadDir',
      'window:openPath',
    ]
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    console.warn('[preload] ipcRenderer.invoke blocked for unauthorized channel:', channel)
    return Promise.reject(new Error(' unauthorized channel'))
  },
})
