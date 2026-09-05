import { ipcMain, clipboard } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { clipboardChannels } from './ipcClient'

export function registerClipboardHandlers() {
  ipcMain.handle(clipboardChannels.writeText, (_event, text: string) => {
    try {
      clipboard.writeText(text)
    } catch (err) {
      ipcLogger.error('[clipboard] writeText failed:', err)
    }
  })

  ipcMain.handle(clipboardChannels.readText, () => {
    try {
      return clipboard.readText()
    } catch (err) {
      ipcLogger.error('[clipboard] readText failed:', err)
      return ''
    }
  })
}