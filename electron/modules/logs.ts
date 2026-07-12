// logs 模块 - 定义 IPC channel 和方法映射
export const logChannels = {
  list: 'logs:list',
  read: 'logs:read',
  dir: 'logs:dir',
}

export function createLogsProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(logChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return proxy
}

export type LogsModule = ReturnType<typeof createLogsProxy>
