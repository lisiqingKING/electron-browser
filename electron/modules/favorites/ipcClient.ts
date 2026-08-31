// favorites 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'

export const favoritesChannels = {
  list: 'favorites:list',
  add: 'favorites:add',
  remove: 'favorites:remove',
  check: 'favorites:check',
  toggle: 'favorites:toggle',
}

export function createFavoritesProxy() {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(favoritesChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  // push 事件订阅
  const changedListeners = new Set<(favorites: any[]) => void>()

  ipcRenderer.on('favorites:changed', (_event, favorites: any[]) => {
    changedListeners.forEach(fn => fn(favorites))
  })

  proxy.onChanged = (fn: (favorites: any[]) => void) => { changedListeners.add(fn) }
  proxy.removeOnChanged = (fn: (favorites: any[]) => void) => { changedListeners.delete(fn) }

  return proxy
}

export type FavoritesModule = ReturnType<typeof createFavoritesProxy>
