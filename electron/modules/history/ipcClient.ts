// history 模块 - 定义 IPC channel 和方法映射
export const historyChannels = {
  get: 'history:get',
  clear: 'history:clear',
  delete: 'history:delete',
}

export function createHistoryProxy(ipcRenderer: Electron.IpcRenderer) {
  return {
    get: (...args: unknown[]) => ipcRenderer.invoke(historyChannels.get, ...args),
    clear: (...args: unknown[]) => ipcRenderer.invoke(historyChannels.clear, ...args),
    delete: (...args: unknown[]) => ipcRenderer.invoke(historyChannels.delete, ...args),
  }
}

export type HistoryModule = ReturnType<typeof createHistoryProxy>
