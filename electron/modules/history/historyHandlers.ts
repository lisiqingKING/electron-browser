import { ipcMain } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { getHistory, clearAllHistory, deleteRecord } from './manager'

export function registerHistoryHandlers() {
  ipcMain.handle('history:get', async () => {
    return getHistory()
  })

  ipcMain.handle('history:clear', async () => {
    try {
      clearAllHistory()
      return true
    } catch (err) {
      ipcLogger.error(`history:clear failed: ${err}`)
      return false
    }
  })

  ipcMain.handle('history:delete', async (_event, id: number) => {
    try {
      deleteRecord(id)
      return true
    } catch (err) {
      ipcLogger.error(`history:delete failed: ${err}`)
      return false
    }
  })
}
