import { ipcMain } from 'electron'
import { searchChannels } from './ipcClient'
import { searchNotes, searchMessages } from './searchDb'

export function registerSearchHandlers() {
  ipcMain.handle(searchChannels.query, async (_event, keyword: string) => {
    return {
      notes: searchNotes(keyword),
      messages: searchMessages(keyword),
    }
  })
}
