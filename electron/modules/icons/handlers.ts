import { ipcMain } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { iconsChannels } from './ipcClient'
import { fetchIconForPage } from './manager'

export function registerIconsHandlers() {
  ipcMain.handle(iconsChannels.fetch, async (_event, pageUrl: string) => {
    if (typeof pageUrl !== 'string' || !pageUrl) return null
    try {
      return await fetchIconForPage(pageUrl)
    } catch (err) {
      ipcLogger.error(`icons:fetch failed: ${err}`)
      return null
    }
  })
}
