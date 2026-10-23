// shortcuts 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'
import { createSubscription } from '../../shared/subscription'

export const shortcutsChannels = {
  list: 'shortcuts:list',
  add: 'shortcuts:add',
  remove: 'shortcuts:remove',
  changed: 'shortcuts:changed',
}

export function createShortcutsProxy() {
  const { subscribe } = createSubscription(shortcutsChannels.changed)

  return {
    list: () => ipcRenderer.invoke(shortcutsChannels.list),
    add: (input: { name?: string; url: string }) => ipcRenderer.invoke(shortcutsChannels.add, input),
    remove: (id: string) => ipcRenderer.invoke(shortcutsChannels.remove, id),
    onChanged: subscribe,
  }
}

export type ShortcutsModule = ReturnType<typeof createShortcutsProxy>
