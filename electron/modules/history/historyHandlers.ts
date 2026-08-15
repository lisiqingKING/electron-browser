import { ipcMain } from 'electron'
import { getHistory, clearAllHistory, deleteRecord } from './manager'

export function registerHistoryHandlers() {
  ipcMain.handle('history:get', async () => {
    return getHistory()
  })

  ipcMain.handle('history:clear', async () => {
    clearAllHistory()
    return true
  })

  ipcMain.handle('history:delete', async (_event, id: number) => {
    deleteRecord(id)
    return true
  })
}
