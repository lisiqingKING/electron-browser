import { ipcMain } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { broadcast } from '../../shared/broadcast'
import { isValidId } from '../../shared/ids'
import { fetchIconForPage } from '../icons/manager'
import { shortcutsChannels } from './ipcClient'
import { addShortcut, getAllShortcuts, removeShortcut, setShortcutIcon } from './manager'

/**
 * 快捷方式是全局数据，广播给所有窗口 + 所有标签页内的子应用。
 * 渲染进程收到推送后重新 list，不自行改本地状态。
 */
export function broadcastShortcutsChanged(): void {
  broadcast(shortcutsChannels.changed, getAllShortcuts())
}

/**
 * 抓 favicon 并回填。
 *
 * 不 await —— 添加要立刻返回，抓图标是网络请求，卡住它等于卡住用户。
 * 图标到位后二次广播，渲染层原地替换占位图。
 */
async function attachIcon(id: string, url: string): Promise<void> {
  try {
    const icon = await fetchIconForPage(url)
    if (!icon) return
    setShortcutIcon(id, icon)
    broadcastShortcutsChanged()
  } catch (err) {
    ipcLogger.error(`shortcuts:attachIcon failed: ${err}`)
  }
}

export function registerShortcutsHandlers() {
  ipcMain.handle(shortcutsChannels.list, async () => {
    return getAllShortcuts()
  })

  ipcMain.handle(shortcutsChannels.add, async (_event, input: { name?: string; url: string }) => {
    try {
      const shortcut = addShortcut(input)
      broadcastShortcutsChanged()
      void attachIcon(shortcut.id, shortcut.url)
      return shortcut
    } catch (err) {
      ipcLogger.error(`shortcuts:add failed: ${err}`)
      throw err
    }
  })

  ipcMain.handle(shortcutsChannels.remove, async (_event, id: string) => {
    if (!isValidId(id)) return false
    try {
      const removed = removeShortcut(id)
      if (removed) broadcastShortcutsChanged()
      return removed
    } catch (err) {
      ipcLogger.error(`shortcuts:remove failed: ${err}`)
      return false
    }
  })
}
