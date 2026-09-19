// wallpaper 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'
import { createSubscription } from '../../shared/subscription'

export const wallpaperChannels = {
  wallpaperPick: 'wallpaper:pick',
  wallpaperChanged: 'wallpaper:changed',
}

export function createWallpaperProxy() {
  const { subscribe: subscribeWallpaper } = createSubscription(wallpaperChannels.wallpaperChanged)

  return {
    onWallpaperChanged: subscribeWallpaper,
    pickWallpaper: () => ipcRenderer.invoke(wallpaperChannels.wallpaperPick),
    getWallpaperImage: (filePath: string) => ipcRenderer.invoke('wallpaper:getImage', filePath),
    getBuiltinSkinImage: (name: string) => ipcRenderer.invoke('wallpaper:getBuiltinImage', name),
    getBuiltinSkinColor: (name: string) => ipcRenderer.invoke('wallpaper:getBuiltinColor', name),
  }
}

export type WallpaperModule = ReturnType<typeof createWallpaperProxy>
