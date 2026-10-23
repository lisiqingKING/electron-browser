// icons 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'

export const iconsChannels = {
  fetch: 'icons:fetch',
}

export function createIconsProxy() {
  return {
    fetch: (pageUrl: string) => ipcRenderer.invoke(iconsChannels.fetch, pageUrl),
  }
}

export type IconsModule = ReturnType<typeof createIconsProxy>
