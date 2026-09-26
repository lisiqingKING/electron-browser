import { ipcMain, dialog, app } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { wallpaperChannels } from './ipcClient'
import { extractColorFromBuffer } from './colorExtractor'
import { getAllWindows } from '../../windows/windowManager'
import { getTabContext } from '../../tabs/state'
import { isInternalTab } from '../../tabs/tabCore'
import * as fs from 'fs'
import * as path from 'path'

function getBuiltinSkinPath(name: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath!, 'skins', name)
  }
  return path.join(app.getAppPath(), 'resources', 'skins', name)
}

export function registerWallpaperHandlers() {
  ipcMain.handle(wallpaperChannels.wallpaperPick, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择皮肤图片',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const srcPath = result.filePaths[0]
    const skinsDir = path.join(app.getPath('userData'), 'skins')

    if (!fs.existsSync(skinsDir)) {
      fs.mkdirSync(skinsDir, { recursive: true })
    }

    const fileName = `custom-${Date.now()}${path.extname(srcPath)}`
    const destPath = path.join(skinsDir, fileName)
    fs.copyFileSync(srcPath, destPath)

    const buffer = fs.readFileSync(destPath)
    const { isLight } = await extractColorFromBuffer(buffer)

    ipcLogger.info('[wallpaperPick] saved to:', destPath, 'isLight:', isLight)
    return { path: destPath, isLight }
  })

  ipcMain.handle('wallpaper:getImage', async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) return null
      const buffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp', '.bmp': 'image/bmp'
      }
      const mime = mimeTypes[ext] || 'image/jpeg'
      return `data:${mime};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('wallpaper:getBuiltinImage', async (_event, name: string) => {
    try {
      const skinPath = getBuiltinSkinPath(name)
      if (!fs.existsSync(skinPath)) {
        ipcLogger.debug('[wallpaper:getBuiltinImage] skin not found:', skinPath)
        return null
      }
      const buffer = fs.readFileSync(skinPath)
      const ext = path.extname(skinPath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp', '.bmp': 'image/bmp'
      }
      const mime = mimeTypes[ext] || 'image/jpeg'
      return `data:${mime};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('wallpaper:getBuiltinColor', async (_event, name: string) => {
    try {
      const skinPath = getBuiltinSkinPath(name)
      if (!fs.existsSync(skinPath)) {
        return null
      }
      const buffer = fs.readFileSync(skinPath)
      const result = await extractColorFromBuffer(buffer)
      return result
    } catch {
      return null
    }
  })

  // 监听 settings 的 wallpaper 变化，广播给渲染进程
  ipcMain.handle('wallpaper:broadcastChange', async (_event, data: unknown) => {
    for (const w of getAllWindows()) {
      w.webContents.send(wallpaperChannels.wallpaperChanged, data)
      const ctx = getTabContext(w)
      for (const [, tab] of ctx.webContentViewMap) {
        if (isInternalTab(tab) && tab.view) {
          tab.view.webContents.send(wallpaperChannels.wallpaperChanged, data)
        }
      }
    }
  })
}
