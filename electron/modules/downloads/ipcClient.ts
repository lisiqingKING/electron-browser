// downloads 模块 - 渲染层 proxy 工厂
import { ipcRenderer } from 'electron'
import { downloadsChannels, blobChannels } from './channels'
export { downloadsChannels }

// 事件订阅通过 window.bridge.on('downloads:added') 等独立 channel 进行
// 不在 proxy 中封装事件订阅方法

export function createDownloadsProxy() {
  return {
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
  }
}

export type DownloadsModule = ReturnType<typeof createDownloadsProxy>
