// settings 模块 - 定义 IPC channel 和方法映射
export const settingsChannels = {
  get: 'settings:get',
  set: 'settings:set',
  getAll: 'settings:getAll',
}

export function createSettingsProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(settingsChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return proxy
}

export type SettingsModule = ReturnType<typeof createSettingsProxy>
