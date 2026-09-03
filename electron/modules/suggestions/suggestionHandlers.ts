import { ipcMain } from 'electron'
import { getAllFavorites } from '../favorites/manager'
import { getHistory } from '../history/manager'
import { suggestionChannels } from './ipcClient'

export function registerSuggestionHandlers(): void {
  ipcMain.handle(suggestionChannels.get, async () => {
    const [favorites, history] = await Promise.all([
      getAllFavorites(),
      getHistory(),
    ])
    return {
      favorites,
      history: history.slice(0, 20),
    }
  })
}
