import { ipcMain, nativeTheme } from 'electron'
import { ipcLogger } from '../../shared/logger'
import type { Theme } from '../../shared/types'
import { getSetting, setSetting, getAllSettings } from './manager'
import { isInternalTab } from '../../tabs/tabCore'
import { getAllWindows } from '../../windows/windowManager'
import { getTabContext } from '../../tabs/state'

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return getSetting(key)
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    try {
      setSetting(key, value)
    } catch (err) {
      ipcLogger.error(`settings:set failed for key ${key}: ${err}`)
      return false
    }
    if (key === 'theme') {
      nativeTheme.themeSource = value as Theme
      ipcLogger.info('[settingsHandlers] broadcasting theme:', value)
      for (const w of getAllWindows()) {
        w.webContents.send('settings:theme-changed', value)
        const ctx = getTabContext(w)
        for (const [, tab] of ctx.webContentViewMap) {
          if (isInternalTab(tab) && tab.view) {
            ipcLogger.debug('[settingsHandlers] sending to tab:', tab.info.id, 'url:', tab.info.url)
            tab.view.webContents.send('settings:theme-changed', value)
          }
        }
      }
    }
    return true
  })

  ipcMain.handle('settings:getAll', async () => {
    return getAllSettings()
  })
}
