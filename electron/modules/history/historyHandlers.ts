import { ipcMain } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { getHistory, clearAllHistory, deleteRecord } from './manager'
import { historyChannels } from './ipcClient'

export function registerHistoryHandlers() {
  ipcMain.handle(historyChannels.get, async () => {
    return getHistory()
  })

  ipcMain.handle(historyChannels.clear, async () => {
    try {
      clearAllHistory()
      return true
    } catch (err) {
      ipcLogger.error(`history:clear failed: ${err}`)
      return false
    }
  })

  ipcMain.handle(historyChannels.delete, async (_event, id: number) => {
    try {
      deleteRecord(id)
      return true
    } catch (err) {
      ipcLogger.error(`history:delete failed: ${err}`)
      return false
    }
  })
}
