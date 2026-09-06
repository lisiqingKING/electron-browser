// downloads 模块 - 渲染层 proxy 工厂
import { ipcRenderer } from 'electron'
import { downloadsChannels, blobChannels } from './channels'
export { downloadsChannels }

const EVENT_CHANNEL = downloadsChannels.event

export function createDownloadsProxy() {
  const onAddedFn = new Set<(task: unknown) => void>()
  const onProgressFn = new Set<(progress: unknown) => void>()
  const onRemovedFn = new Set<(id: string) => void>()
  let listenerRegistered = false

  function handleEvent(_event: Electron.IpcRendererEvent, data: unknown) {
    const d = data as { type: string; task?: unknown; progress?: unknown; id?: string }
    if (d?.type === 'added') onAddedFn.forEach(fn => fn(d.task))
    else if (d?.type === 'progress') onProgressFn.forEach(fn => fn(d.progress))
    else if (d?.type === 'removed' && d.id != null) {
      onRemovedFn.forEach(fn => fn(d.id as string))
    }
  }

  function ensureListener() {
    if (!listenerRegistered) {
      ipcRenderer.on(EVENT_CHANNEL, handleEvent)
      listenerRegistered = true
    }
  }

  function cleanupIfEmpty() {
    if (onAddedFn.size === 0 && onProgressFn.size === 0 && onRemovedFn.size === 0) {
      ipcRenderer.removeListener(EVENT_CHANNEL, handleEvent)
      listenerRegistered = false
    }
  }

  const proxy = {
    list: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.list, ...args),
    add: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.add, ...args),
    pause: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.pause, ...args),
    resume: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.resume, ...args),
    cancel: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.cancel, ...args),
    remove: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.remove, ...args),
    reveal: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.reveal, ...args),
    openFile: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.openFile, ...args),
    clear: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.clear, ...args),
    directDownloadUrl: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.directDownloadUrl, ...args),
    getSaveDir: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.getSaveDir, ...args),
    selectSaveDir: (...args: unknown[]) => ipcRenderer.invoke(downloadsChannels.selectSaveDir, ...args),
    writeBlob: (...args: unknown[]) => ipcRenderer.invoke(blobChannels.write, ...args),

    onAdded(fn: (task: unknown) => void) {
      ensureListener()
      onAddedFn.add(fn)
      return () => { onAddedFn.delete(fn); cleanupIfEmpty() }
    },
    onProgress(fn: (progress: unknown) => void) {
      ensureListener()
      onProgressFn.add(fn)
      return () => { onProgressFn.delete(fn); cleanupIfEmpty() }
    },
    onRemoved(fn: (id: string) => void) {
      ensureListener()
      onRemovedFn.add(fn)
      return () => { onRemovedFn.delete(fn); cleanupIfEmpty() }
    },
  }

  return proxy
}

export type DownloadsModule = ReturnType<typeof createDownloadsProxy>
