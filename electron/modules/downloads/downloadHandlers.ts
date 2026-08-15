import { ipcMain } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { getDownloadManager, downloadsChannels } from './manager'
import type { AddHttpInput } from './downloadTypes'

export function registerDownloadHandlers(): void {
  const manager = getDownloadManager()

  ipcMain.handle(downloadsChannels.list, () => manager.list().map((t) => t.toJSON()))

  ipcMain.handle(downloadsChannels.add, (_event, input: AddHttpInput) => {
    if (!input || typeof input.url !== 'string' || input.url.length === 0) {
      ipcLogger.error(`downloads:add invalid input: ${JSON.stringify(input)}`)
      throw new Error('invalid url')
    }
    return manager.addHttpTask(input).toJSON()
  })

  ipcMain.handle(downloadsChannels.pause, (_event, id: string) => manager.pause(id))

  ipcMain.handle(downloadsChannels.resume, (_event, id: string) => manager.resume(id))

  ipcMain.handle(downloadsChannels.cancel, async (_event, id: string) => {
    await manager.cancel(id)
    return true
  })

  ipcMain.handle(downloadsChannels.remove, async (_event, id: string) => {
    await manager.remove(id)
    return true
  })

  ipcMain.handle(downloadsChannels.reveal, (_event, id: string) => manager.reveal(id))

  ipcMain.handle(downloadsChannels.clear, async () => manager.clearAll())
}
