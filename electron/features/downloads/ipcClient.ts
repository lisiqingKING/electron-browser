// downloads 模块 - 渲染层 proxy 工厂
import { downloadsChannels } from './channels'

// 推送给渲染端的事件 channel (proxy 不暴露给 renderer)
const pushChannels = new Set<string>([downloadsChannels.event, downloadsChannels.listChanged])

export function createDownloadsProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(downloadsChannels)) {
    if (pushChannels.has(channel as string)) continue
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return proxy
}

export type DownloadsModule = ReturnType<typeof createDownloadsProxy>
