// history 模块 - 定义 IPC channel 和方法映射
export const historyChannels = {
  get: 'history:get',
  clear: 'history:clear',
  delete: 'history:delete',
}

export function createHistoryProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(historyChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return proxy
}

export type HistoryModule = ReturnType<typeof createHistoryProxy>
