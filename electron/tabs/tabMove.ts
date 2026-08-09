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

  let lastDragOutTime = 0

  ipcMain.handle('tab:drag-out-to-window', async (_event, tabId: string, screenPos?: { x: number; y: number }) => {
    const now = Date.now()
    if (now - lastDragOutTime < 500) return false
    lastDragOutTime = now
    try {
      const oldWin = BrowserWindow.fromWebContents(_event.sender)
      if (!oldWin || oldWin.isDestroyed()) return false

      const oldCtx = getCtx(oldWin)
      const tabEntry = oldCtx.webContentViewMap.get(tabId)
      if (!tabEntry) return false

      const { view, info: tabInfo } = tabEntry
      if (!view) return false

      const oldCurTabId = oldCtx.curTabId

      // 复用储备窗口（已预创建，速度快）
      const newWin = activateReserveWindow()
      if (newWin.isDestroyed()) return false

      // 定位窗口到鼠标位置
      if (screenPos) {
        newWin.setPosition(screenPos.x - Math.floor(newWin.getSize()[0] / 2), screenPos.y - 48)
      }

      // view 是引用传递，直接从旧窗口移除后加入新窗口即可
      oldWin.contentView.removeChildView(view)
      newWin.contentView.addChildView(view)

      // 设置新窗口的 tab 上下文（保留 home tab）
      const newCtx = getCtx(newWin)
      const homeTab = newCtx.tabs.find(t => t.isHome)
      const homeEntry = homeTab ? newCtx.webContentViewMap.get(homeTab.id!) : undefined
      newCtx.tabs = []
      newCtx.webContentViewMap.clear()
      if (homeTab) {
        newCtx.tabs.push(homeTab)
        if (homeEntry) newCtx.webContentViewMap.set(homeTab.id!, homeEntry)
      }
      newCtx.tabs.push(tabInfo)
      newCtx.webContentViewMap.set(tabId, { info: tabInfo, view })
      newCtx.curTabId = tabId

      updateCurTabBounds({ info: tabInfo, view }, newWin)
      moveTabToWindow(tabId, newWin)

      // 从旧窗口的 tabs 列表移除
      const removeIdx = oldCtx.tabs.findIndex(t => t.id === tabId)
      if (removeIdx !== -1) {
        oldCtx.tabs.splice(removeIdx, 1)
      }
      oldCtx.webContentViewMap.delete(tabId)

      // 切换旧窗口的当前 tab
      if (oldCurTabId === tabId) {
        if (removeIdx > 0) {
          const newCurTab = oldCtx.tabs[removeIdx - 1]
          if (newCurTab.id) switchTab(newCurTab.id, oldWin)
          if (!oldWin.isDestroyed()) oldWin.webContents.send('tab:current-changed', { currentTabId: oldCtx.curTabId })
        } else if (oldCtx.tabs.length > 0) {
          const newCurTab = oldCtx.tabs[0]
          if (newCurTab.id) switchTab(newCurTab.id, oldWin)
          if (!oldWin.isDestroyed()) oldWin.webContents.send('tab:current-changed', { currentTabId: oldCtx.curTabId })
        } else {
          oldCtx.curTabId = null
        }
      }

      // 广播 tab 列表变化
      if (!newWin.isDestroyed()) {
        const listData = getTabListData(newWin)
        const tabSummary: { id: string | undefined; title: string; isHome?: boolean }[] = []
        for (const t of listData.tabs) {
          if (t) tabSummary.push({ id: t.id, title: t.title, isHome: t.isHome })
        }
        console.log('[tab:drag-out-to-window] newWin tabs:', tabSummary)
        newWin.webContents.send('tab:list-changed', listData)
      }
      if (!oldWin.isDestroyed()) oldWin.webContents.send('tab:list-changed', getTabListData(oldWin))

      return true
    } catch (err) {
      console.error('[tab:drag-out-to-window] error:', err)
      return false
    }
  })
}
