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
  createFavorites: 'tabs:createFavorites',
  list: 'tabs:list',
  switch: 'tabs:switch',
  close: 'tabs:close',
  refresh: 'tabs:refresh',
  updateUrl: 'tabs:updateUrl',
  updateInfo: 'tabs:updateInfo',
  openDevTools: 'tabs:openDevTools',
  reload: 'tabs:reload',
  closeLeft: 'tabs:closeLeft',
  closeRight: 'tabs:closeRight',
  closeOthers: 'tabs:closeOthers',
  goBack: 'tabs:goBack',
  goForward: 'tabs:goForward',
  restore: 'tabs:restore',
  clearSaved: 'tabs:clearSaved',
  showRestorePrompt: 'tabs:showRestorePrompt',
}

// 返回值的方法（invoke）
const invokeMethods = ['create', 'createDefault', 'createHome', 'createHistory', 'createDownloads', 'createSettings', 'createAI', 'createLogs', 'createAiSaves', 'createFavorites', 'list', 'switch', 'close', 'restore', 'clearSaved']

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
