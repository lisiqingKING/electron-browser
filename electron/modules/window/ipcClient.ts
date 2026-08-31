import { ipcRenderer } from 'electron'

export const windowChannels = {
  minimize: 'window:minimize',
  maximize: 'window:maximize',
  close: 'window:close',
  isMaximized: 'window:isMaximized',
  adoptTab: 'window:adopt-tab',
  updatePosition: 'window:update-position',
}

export function createWindowProxy() {
  const proxy: Record<string, Function> = {}

  proxy.minimize = (...args: unknown[]) => ipcRenderer.invoke(windowChannels.minimize, ...args)
  proxy.maximize = (...args: unknown[]) => ipcRenderer.invoke(windowChannels.maximize, ...args)
  proxy.close = (...args: unknown[]) => ipcRenderer.invoke(windowChannels.close, ...args)
  proxy.isMaximized = (...args: unknown[]) => ipcRenderer.invoke(windowChannels.isMaximized, ...args)
  proxy.adoptTab = (...args: unknown[]) => ipcRenderer.invoke(windowChannels.adoptTab, ...args)
  proxy.updatePosition = (...args: unknown[]) => ipcRenderer.invoke(windowChannels.updatePosition, ...args)

  // push 事件订阅（lazy registration）
  const maximizeChangedListeners = new Set<(maximized: boolean) => void>()
  let listenerRegistered = false

  function handleMaximizeChanged(_event: Electron.IpcRendererEvent, maximized: boolean) {
    maximizeChangedListeners.forEach(fn => fn(maximized))
  }

  function ensureListener() {
    if (!listenerRegistered) {
      ipcRenderer.on('window:maximize-changed', handleMaximizeChanged)
      listenerRegistered = true
    }
  }

  function cleanupIfEmpty() {
    if (maximizeChangedListeners.size === 0) {
      ipcRenderer.removeListener('window:maximize-changed', handleMaximizeChanged)
      listenerRegistered = false
    }
  }

  proxy.onMaximizeChanged = (fn: (maximized: boolean) => void) => { ensureListener(); maximizeChangedListeners.add(fn) }
  proxy.removeOnMaximizeChanged = (fn: (maximized: boolean) => void) => { maximizeChangedListeners.delete(fn); cleanupIfEmpty() }

  return proxy
}

export type WindowModule = ReturnType<typeof createWindowProxy>