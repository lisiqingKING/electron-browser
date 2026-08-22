import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => func(...args))
  },
  off: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.off(channel, (_event, ...args) => func(...args))
  },
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
})

ipcRenderer.on('popup:hide', () => {
  window.close()
})