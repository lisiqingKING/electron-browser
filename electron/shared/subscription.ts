import { ipcRenderer } from 'electron'

type SubscriptionCallback = (...args: unknown[]) => void
type Unsubscribe = () => void

/**
 * 单 channel 多订阅者工厂
 * - 首次 subscribe 时注册 ipcRenderer.on
 * - 最后一个订阅者取消时移除 ipcRenderer.on
 */
export function createSubscription(channel: string) {
  const listeners = new Set<SubscriptionCallback>()
  let registered = false

  function handle(_event: Electron.IpcRendererEvent, ...args: unknown[]) {
    listeners.forEach(fn => fn(...args))
  }

  function ensure() {
    if (!registered) {
      ipcRenderer.on(channel, handle)
      registered = true
    }
  }

  function cleanup() {
    if (listeners.size === 0) {
      ipcRenderer.removeListener(channel, handle)
      registered = false
    }
  }

  return {
    subscribe(fn: SubscriptionCallback): Unsubscribe {
      ensure()
      listeners.add(fn)
      return () => { listeners.delete(fn); cleanup() }
    },
  }
}

export type { Unsubscribe }
