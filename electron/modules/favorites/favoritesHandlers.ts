import { ipcMain } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { getAllFavorites, checkFavorite, toggleFavorite, removeFavorite } from './manager'

export function registerFavoritesHandlers() {
  ipcMain.handle('favorites:list', async () => {
    return getAllFavorites()
  })

  ipcMain.handle('favorites:check', async (_event, url: string) => {
    return checkFavorite(url)
  })

  ipcMain.handle('favorites:toggle', async (_event, url: string, title: string, favicon?: string) => {
    try {
      return toggleFavorite(url, title, favicon)
    } catch (err) {
      ipcLogger.error(`favorites:toggle failed: ${err}`)
      throw err
    }
  })

  ipcMain.handle('favorites:remove', async (_event, url: string) => {
    try {
      removeFavorite(url)
      return true
    } catch (err) {
      ipcLogger.error(`favorites:remove failed: ${err}`)
      return false
    }
  })
}
