// settings 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'

export const settingsChannels = {
  get: 'settings:get',
  set: 'settings:set',
  getAll: 'settings:getAll',
  themeChanged: 'settings:theme-changed',
}

export function createSettingsProxy() {
  const proxy: Record<string, Function> = {}

  // 主题变更订阅表
  const themeListeners = new Set<(theme: string) => void>()

  // 主进程 push → 转发给订阅者（渲染进程只知道 onThemeChanged，不知道 channel）
  ipcRenderer.on(settingsChannels.themeChanged, (_event, value) => {
    themeListeners.forEach(fn => fn(value))
  })

  proxy.onThemeChanged = (fn: (theme: string) => void) => { themeListeners.add(fn) }
  proxy.removeOnThemeChanged = (fn: (theme: string) => void) => { themeListeners.delete(fn) }

  proxy.get = (...args: unknown[]) => ipcRenderer.invoke(settingsChannels.get, ...args)
  proxy.set = (...args: unknown[]) => ipcRenderer.invoke(settingsChannels.set, ...args)
  proxy.getAll = (...args: unknown[]) => ipcRenderer.invoke(settingsChannels.getAll, ...args)

  return proxy
}

export type SettingsModule = ReturnType<typeof createSettingsProxy>
