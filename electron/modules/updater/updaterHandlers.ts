import { ipcMain } from 'electron'
import { updater, updaterChannels } from './updater'

export function registerUpdaterHandlers() {
  updater.init()
  ipcMain.handle(updaterChannels.checkForUpdates, () => updater.checkForUpdates())
  ipcMain.handle(updaterChannels.downloadUpdate, () => updater.downloadUpdate())
  ipcMain.handle(updaterChannels.quitAndInstall, () => updater.quitAndInstall())
  ipcMain.handle(updaterChannels.getUpdateStatus, () => updater.getStatus())
  setTimeout(() => updater.checkForUpdates(), 1 * 60 * 1000)
}
