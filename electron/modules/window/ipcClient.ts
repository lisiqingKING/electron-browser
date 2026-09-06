import { ipcRenderer } from 'electron'
import { createSubscription } from '../../shared/subscription'

export const windowChannels = {
  minimize: 'window:minimize',
  maximize: 'window:maximize',
  close: 'window:close',
  isMaximized: 'window:isMaximized',
  adoptTab: 'window:adoptTab',
  updatePosition: 'window:updatePosition',
  getContentBounds: 'window:getContentBounds',
  maximizeChanged: 'window:maximize-changed',
  create: 'window:create',
  quit: 'app:quit',
  list: 'window:list',
  selectDownloadDir: 'window:selectDownloadDir',
  openPath: 'window:openPath',
  getDownloadDir: 'window:getDownloadDir',
}

export function createWindowProxy() {
  const { subscribe } = createSubscription(windowChannels.maximizeChanged)

  return {
    minimize: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.minimize, ...args),
    maximize: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.maximize, ...args),
    close: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.close, ...args),
    isMaximized: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.isMaximized, ...args),
    adoptTab: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.adoptTab, ...args),
    updatePosition: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.updatePosition, ...args),
    getContentBounds: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.getContentBounds, ...args),
    create: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.create, ...args),
    quit: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.quit, ...args),
    openPath: (...args: unknown[]) => ipcRenderer.invoke(windowChannels.openPath, ...args),
    onMaximizeChanged: subscribe,
  }
}

export type WindowModule = ReturnType<typeof createWindowProxy>
