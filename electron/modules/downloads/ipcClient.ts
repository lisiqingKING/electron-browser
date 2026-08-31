// downloads 模块 - 渲染层 proxy 工厂
import { ipcRenderer } from 'electron'
import { downloadsChannels, blobChannels } from './channels'

// push channel，不在 invoke proxy 中暴露
const PUSH_CHANNEL = downloadsChannels.event

export function createDownloadsProxy() {
  const proxy: Record<string, Function> = {}

  // 订阅表
  const onAddedFn = new Set<Function>()
  const onProgressFn = new Set<Function>()
  const onRemovedFn = new Set<Function>()
  let listenerRegistered = false

  function handleEvent(_event: Electron.IpcRendererEvent, data: any) {
    if (data?.type === 'added') onAddedFn.forEach(fn => fn(data.task))
    else if (data?.type === 'progress') onProgressFn.forEach(fn => fn(data.progress))
    else if (data?.type === 'removed') onRemovedFn.forEach(fn => fn(data.id))
  }

  function ensureListener() {
    if (!listenerRegistered) {
      ipcRenderer.on(PUSH_CHANNEL, handleEvent)
      listenerRegistered = true
    }
  }

  function cleanupIfEmpty() {
    if (onAddedFn.size === 0 && onProgressFn.size === 0 && onRemovedFn.size === 0) {
      ipcRenderer.removeListener(PUSH_CHANNEL, handleEvent)
      listenerRegistered = false
    }
  }

  proxy.onAdded = (fn: Function) => { ensureListener(); onAddedFn.add(fn) }
  proxy.onProgress = (fn: Function) => { ensureListener(); onProgressFn.add(fn) }
  proxy.onRemoved = (fn: Function) => { ensureListener(); onRemovedFn.add(fn) }
  proxy.removeOnAdded = (fn: Function) => { onAddedFn.delete(fn); cleanupIfEmpty() }
  proxy.removeOnProgress = (fn: Function) => { onProgressFn.delete(fn); cleanupIfEmpty() }
  proxy.removeOnRemoved = (fn: Function) => { onRemovedFn.delete(fn); cleanupIfEmpty() }

  for (const [method, channel] of Object.entries(downloadsChannels)) {
    if (channel === PUSH_CHANNEL) continue
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  proxy.writeBlob = (...args: unknown[]) => ipcRenderer.invoke(blobChannels.write, ...args)

  return proxy
}

export type DownloadsModule = ReturnType<typeof createDownloadsProxy>
