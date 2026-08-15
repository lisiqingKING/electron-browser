import { popupChannels } from './channels'

export function createPopupProxy(ipcRenderer: Electron.IpcRenderer) {
  return {
    show: (options: unknown) => ipcRenderer.send(popupChannels.show, options),
    hide: () => ipcRenderer.send(popupChannels.hide),
    action: (data: unknown) => ipcRenderer.send(popupChannels.action, data),
  }
}

export type PopupModule = ReturnType<typeof createPopupProxy>
