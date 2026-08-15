import { ipcMain } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { updater, updaterChannels } from './updater'

export function registerUpdaterHandlers() {
  updater.init()
  ipcMain.handle(updaterChannels.checkForUpdates, async () => {
    try {
      return await updater.checkForUpdates()
    } catch (err) {
      ipcLogger.error(`updater:checkForUpdates failed: ${err}`)
      throw err
    }
  })
  ipcMain.handle(updaterChannels.downloadUpdate, async () => {
    try {
      return await updater.downloadUpdate()
    } catch (err) {
      ipcLogger.error(`updater:downloadUpdate failed: ${err}`)
      throw err
    }
  })
  ipcMain.handle(updaterChannels.quitAndInstall, () => updater.quitAndInstall())
  ipcMain.handle(updaterChannels.getUpdateStatus, () => updater.getStatus())
  setTimeout(() => updater.checkForUpdates(), 1 * 60 * 1000)
}
