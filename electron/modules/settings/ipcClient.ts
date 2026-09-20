// settings 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'
import { createSubscription } from '../../shared/subscription'

export const settingsChannels = {
  get: 'settings:get',
  set: 'settings:set',
  getAll: 'settings:getAll',
  themeChanged: 'settings:theme-changed',
  wallpaperBlurChanged: 'settings:wallpaperBlur-changed',
}

export function createSettingsProxy() {
  const { subscribe: subscribeTheme } = createSubscription(settingsChannels.themeChanged)

  return {
    get: (...args: unknown[]) => ipcRenderer.invoke(settingsChannels.get, ...args),
    set: (...args: unknown[]) => ipcRenderer.invoke(settingsChannels.set, ...args),
    getAll: (...args: unknown[]) => ipcRenderer.invoke(settingsChannels.getAll, ...args),
    onThemeChanged: subscribeTheme,
  }
}

export type SettingsModule = ReturnType<typeof createSettingsProxy>
