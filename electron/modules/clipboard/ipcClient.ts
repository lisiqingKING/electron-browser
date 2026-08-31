import { ipcRenderer } from 'electron'

export const clipboardChannels = {
  readText: 'clipboard:readText',
  writeText: 'clipboard:writeText',
}

export function createClipboardProxy() {
  const proxy: Record<string, Function> = {}

  proxy.readText = (...args: unknown[]) => ipcRenderer.invoke(clipboardChannels.readText, ...args)
  proxy.writeText = (...args: unknown[]) => ipcRenderer.invoke(clipboardChannels.writeText, ...args)

  return proxy
}

export type ClipboardModule = ReturnType<typeof createClipboardProxy>