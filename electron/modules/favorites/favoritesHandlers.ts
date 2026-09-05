import { ipcMain, BrowserWindow } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { getAllFavorites, checkFavorite, toggleFavorite, removeFavorite } from './manager'
import { favoritesChannels } from './ipcClient'

function broadcastFavoritesChanged() {
  const favorites = getAllFavorites()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(favoritesChannels.changed, favorites)
  }
}

export function registerFavoritesHandlers() {
  ipcMain.handle(favoritesChannels.list, async () => {
    return getAllFavorites()
  })

  ipcMain.handle(favoritesChannels.check, async (_event, url: string) => {
    return checkFavorite(url)
  })

  ipcMain.handle(favoritesChannels.toggle, async (_event, url: string, title: string, favicon?: string) => {
    try {
      const result = toggleFavorite(url, title, favicon)
      broadcastFavoritesChanged()
      return result
    } catch (err) {
      ipcLogger.error(`favorites:toggle failed: ${err}`)
      throw err
    }
  })

  ipcMain.handle(favoritesChannels.remove, async (_event, url: string) => {
    try {
      removeFavorite(url)
      broadcastFavoritesChanged()
      return true
    } catch (err) {
      ipcLogger.error(`favorites:remove failed: ${err}`)
      return false
    }
  })
}
