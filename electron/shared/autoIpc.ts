import { ipcMain, IpcRenderer } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Module = Record<string, (...args: any[]) => any>

export function registerModuleHandlers(moduleName: string, module: Module) {
  for (const [method, fn] of Object.entries(module)) {
    if (typeof fn === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ipcMain.handle(`${moduleName}:${method}`, fn as (...args: unknown[]) => unknown)
    }
  }
}

export function createProxy(moduleName: string, module: Module, ipcRenderer: IpcRenderer) {
  const proxy: Record<string, Function> = {}
  for (const [method, fn] of Object.entries(module)) {
    if (typeof fn === 'function') {
      proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(`${moduleName}:${method}`, ...args)
    }
  }
  return proxy
}
