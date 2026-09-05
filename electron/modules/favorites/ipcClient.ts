// favorites 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'
import { createSubscription } from '../../shared/subscription'

export const favoritesChannels = {
  list: 'favorites:list',
  add: 'favorites:add',
  remove: 'favorites:remove',
  check: 'favorites:check',
  toggle: 'favorites:toggle',
  changed: 'favorites:changed',
}

export function createFavoritesProxy() {
  const { subscribe } = createSubscription(favoritesChannels.changed)

  return {
    list: (...args: unknown[]) => ipcRenderer.invoke(favoritesChannels.list, ...args),
    add: (...args: unknown[]) => ipcRenderer.invoke(favoritesChannels.add, ...args),
    remove: (...args: unknown[]) => ipcRenderer.invoke(favoritesChannels.remove, ...args),
    check: (...args: unknown[]) => ipcRenderer.invoke(favoritesChannels.check, ...args),
    toggle: (...args: unknown[]) => ipcRenderer.invoke(favoritesChannels.toggle, ...args),
    onChanged: subscribe,
  }
}

export type FavoritesModule = ReturnType<typeof createFavoritesProxy>
