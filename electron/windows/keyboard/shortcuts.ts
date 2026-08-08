import { BrowserWindow, globalShortcut } from 'electron'
import { getCurTab, closeTab, getTabListData, tabs } from '../../tabs/tabCore'
import { deleteTab } from '../../shared/database'

const ACCELERATOR = 'CmdOrCtrl+W'

function handleCloseTab(win: BrowserWindow) {
  const curTab = getCurTab()
  if (!curTab) return

  if (curTab.info.isHome) {
    // 当前 tab 是首页，关闭最后一个非首页 tab（不切换）
    const lastNonHomeTab = [...tabs].reverse().find(t => !t.isHome)
    if (lastNonHomeTab?.id) {
      closeTab(lastNonHomeTab.id, win)
      deleteTab(lastNonHomeTab.id)
      win.webContents.send('tab:list-changed', getTabListData())
    }
  } else {
    // 正常关闭当前 tab
    const tabId = curTab.info.id!
    closeTab(tabId, win)
    deleteTab(tabId)
    win.webContents.send('tab:list-changed', getTabListData())
  }
}

function registerAllShortcuts(win: BrowserWindow) {
  try {
    globalShortcut.register(ACCELERATOR, () => handleCloseTab(win))
  } catch (err) {
    console.error('[shortcuts] Failed to register:', err)
  }
}

/**
 * 注册应用内全局快捷键
 * - 窗口获得焦点时注册
 * - 窗口失去焦点时注销
 */
export function registerShortcuts(win: BrowserWindow) {
  win.on('focus', () => registerAllShortcuts(win))
  win.on('blur', () => globalShortcut.unregister(ACCELERATOR))
  win.on('closed', () => globalShortcut.unregister(ACCELERATOR))

  registerAllShortcuts(win)
}
