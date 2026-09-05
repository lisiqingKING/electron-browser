import { ipcRenderer } from 'electron'

export const clipboardChannels = {
  readText: 'clipboard:readText',
  writeText: 'clipboard:writeText',
}

export function createClipboardProxy() {
  return {
    readText: (...args: unknown[]) => ipcRenderer.invoke(clipboardChannels.readText, ...args),
    writeText: (...args: unknown[]) => ipcRenderer.invoke(clipboardChannels.writeText, ...args),
  }
}

export type ClipboardModule = ReturnType<typeof createClipboardProxy>