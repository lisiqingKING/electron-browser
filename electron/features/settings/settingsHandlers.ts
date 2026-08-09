import { ipcMain } from 'electron'
import { getSetting, setSetting, getAllSettings } from './settingsManager'
import { isInternalTab } from '../../tabs/tabCore'
import { getAllWindows } from '../../modules/windowManager'
import { getTabContext } from '../../modules/tabContext'

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return getSetting(key)
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    setSetting(key, value)
    if (key === 'theme') {
      for (const w of getAllWindows()) {
        w.webContents.send('settings:theme-changed', value)
        const ctx = getTabContext(w)
        for (const [, tab] of ctx.webContentViewMap) {
          if (isInternalTab(tab)) {
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
