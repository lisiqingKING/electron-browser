// logs 模块 - 定义 IPC channel 和方法映射
export const logChannels = {
  list: 'logs:list',
  read: 'logs:read',
  dir: 'logs:dir',
  renderError: 'render:error',
}

export function createLogsProxy(ipcRenderer: Electron.IpcRenderer) {
  return {
    list: (...args: unknown[]) => ipcRenderer.invoke(logChannels.list, ...args),
    read: (...args: unknown[]) => ipcRenderer.invoke(logChannels.read, ...args),
    dir: (...args: unknown[]) => ipcRenderer.invoke(logChannels.dir, ...args),
    renderError: (data: { message: string; stack?: string; url?: string; line?: number }) => {
      ipcRenderer.send(logChannels.renderError, data)
    },
  }
}

export type LogsModule = ReturnType<typeof createLogsProxy>
