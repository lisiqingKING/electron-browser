import { ipcMain } from 'electron'
import { getAllFavorites, checkFavorite, toggleFavorite, removeFavorite } from './favoritesManager'

export function registerFavoritesHandlers() {
  ipcMain.handle('favorites:list', async () => {
    return getAllFavorites()
  })

  ipcMain.handle('favorites:check', async (_event, url: string) => {
    return checkFavorite(url)
  })

  ipcMain.handle('favorites:toggle', async (_event, url: string, title: string, favicon?: string) => {
    return toggleFavorite(url, title, favicon)
  })

  ipcMain.handle('favorites:remove', async (_event, url: string) => {
    removeFavorite(url)
    return true
  })
}
