// tabs 模块 - 定义 IPC channel 和方法映射
export const tabsChannels = {
  create: 'tabs:create',
  createDefault: 'tabs:createDefault',
  createHome: 'tabs:createHome',
  createHistory: 'tabs:createHistory',
  createDownloads: 'tabs:createDownloads',
  createSettings: 'tabs:createSettings',
  createAI: 'tabs:createAI',
  createLogs: 'tabs:createLogs',
  createAiSaves: 'tabs:createAiSaves',
  list: 'tabs:list',
  switch: 'tabs:switch',
  close: 'tabs:close',
  refresh: 'tabs:refresh',
  updateUrl: 'tabs:updateUrl',
  openDevTools: 'tabs:openDevTools',
}

// 返回值的方法（invoke）
const invokeMethods = ['create', 'createDefault', 'createHome', 'createHistory', 'createDownloads', 'createSettings', 'createAI', 'createLogs', 'createAiSaves', 'list', 'switch', 'close']

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
