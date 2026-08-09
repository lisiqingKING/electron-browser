import { ipcMain, BrowserWindow } from 'electron'
import { getTabEntry, moveTabToWindow } from './state/registry'
import { getTabContext as getCtx, updateCurTabBounds, switchTab, getTabListData } from './state'
import { activateReserveWindow } from '../windows/windowManager'

export function registerTabMove() {
  ipcMain.handle('tab:move-to-window', async (_event, tabId: string) => {
    try {
    const oldWin = BrowserWindow.fromWebContents(_event.sender)
    if (!oldWin || oldWin.isDestroyed()) return false

    const tabEntry = getTabEntry(tabId)
    if (!tabEntry) return false

    const { view, tabInfo } = tabEntry
    if (!view) return false

    const oldCtx = getCtx(oldWin)
    const oldCurTabId = oldCtx.curTabId

    const newWin = activateReserveWindow()
    if (newWin.isDestroyed()) return false

    const newCtx = getCtx(newWin)
    newCtx.tabs.push(tabInfo)
    newCtx.webContentViewMap.set(tabId, { info: tabInfo, view })
    newCtx.curTabId = tabId

    oldWin.contentView.removeChildView(view)
    newWin.contentView.addChildView(view)
    updateCurTabBounds({ info: tabInfo, view }, newWin)

    moveTabToWindow(tabId, newWin)

    const removeIdx = oldCtx.tabs.findIndex(t => t.id === tabId)
    if (removeIdx !== -1) {
      oldCtx.tabs.splice(removeIdx, 1)
    }
    oldCtx.webContentViewMap.delete(tabId)

    if (oldCurTabId === tabId) {
      if (removeIdx > 0) {
        const newCurTab = oldCtx.tabs[removeIdx - 1]
        if (newCurTab.id) {
          switchTab(newCurTab.id, oldWin)
        }
        if (!oldWin.isDestroyed()) {
          oldWin.webContents.send('tab:current-changed', { currentTabId: oldCtx.curTabId })
        }
      } else if (oldCtx.tabs.length > 0) {
        const newCurTab = oldCtx.tabs[0]
        if (newCurTab.id) {
          switchTab(newCurTab.id, oldWin)
        }
        if (!oldWin.isDestroyed()) {
          oldWin.webContents.send('tab:current-changed', { currentTabId: oldCtx.curTabId })
        }
      } else {
        oldCtx.curTabId = null
      }
    }

    if (!newWin.isDestroyed()) {
      newWin.webContents.send('tab:list-changed', getTabListData(newWin))
    }
    if (!oldWin.isDestroyed()) {
      oldWin.webContents.send('tab:list-changed', getTabListData(oldWin))
    }

    return true
    } catch (err) {
      console.error('[tab:move-to-window] error:', err)
      return false
    }
  })
}
