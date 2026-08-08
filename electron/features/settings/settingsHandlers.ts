import { ipcMain, BrowserWindow } from 'electron'
import { getSetting, setSetting, getAllSettings } from './settingsManager'
import { webContentViewMap, isInternalTab } from '../../tabs/tabCore'

export function registerSettingsHandlers(win: BrowserWindow) {
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return getSetting(key)
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    setSetting(key, value)
    // 主题变化时只广播给内部页面
    if (key === 'theme') {
      win.webContents.send('settings:theme-changed', value)
      for (const [, tab] of webContentViewMap) {
        if (isInternalTab(tab)) {
          tab.view.webContents.send('settings:theme-changed', value)
        }
      }
    }
    return true
  })

  ipcMain.handle('settings:getAll', async () => {
    return getAllSettings()
  })
}
