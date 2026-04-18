// tabs 模块 - 定义 IPC channel 和方法映射
export const tabsChannels = {
  create: 'tabs:create',
  createDefault: 'tabs:createDefault',
  createHistory: 'tabs:createHistory',
  list: 'tabs:list',
  switch: 'tabs:switch',
  close: 'tabs:close',
  refresh: 'tabs:refresh',
  openDevTools: 'tabs:openDevTools',
}

// 返回值的方法（invoke）
const invokeMethods = ['create', 'createDefault', 'createHistory', 'list', 'switch', 'close']

// 无返回值的方法（send）
// const sendMethods = ['refresh', 'openDevTools']

export function createTabsProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(tabsChannels)) {
    if (invokeMethods.includes(method)) {
      proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
    } else {
      proxy[method] = (...args: unknown[]) => ipcRenderer.send(channel, ...args)
    }
  }

  return proxy
}

export type TabsModule = ReturnType<typeof createTabsProxy>