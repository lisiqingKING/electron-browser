// favorites 模块 - 定义 IPC channel 和方法映射
export const favoritesChannels = {
  list: 'favorites:list',
  add: 'favorites:add',
  remove: 'favorites:remove',
  check: 'favorites:check',
  toggle: 'favorites:toggle',
}

export function createFavoritesProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(favoritesChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return proxy
}

export type FavoritesModule = ReturnType<typeof createFavoritesProxy>
