import { BrowserWindow, globalShortcut } from 'electron'
import { getCurTab, closeTab, getTabListData, getTabContext } from '../../tabs/state'
import { deleteTab } from '../../tabs/tabsDb'
import { mainLogger as logger } from '../../shared/logger'

const ACCELERATOR = 'CmdOrCtrl+W'

function handleCloseTab(win: BrowserWindow) {
  const curTab = getCurTab(win)
  if (!curTab) return

  if (curTab.info.isHome) {
    const ctx = getTabContext(win)
    const lastNonHomeTab = [...ctx.tabs].reverse().find(t => !t.isHome)
    if (lastNonHomeTab?.id) {
      closeTab(lastNonHomeTab.id, win)
      deleteTab()
      win.webContents.send('tab:list-changed', getTabListData(win))
    }
  } else {
    const tabId = curTab.info.id!
    closeTab(tabId, win)
    deleteTab()
    win.webContents.send('tab:list-changed', getTabListData(win))
  }
}

function registerAllShortcuts(win: BrowserWindow) {
  try {
    globalShortcut.register(ACCELERATOR, () => handleCloseTab(win))
  } catch (err) {
    logger.error('Failed to register:', err)
  }
}

export function registerShortcuts(win: BrowserWindow) {
  win.on('focus', () => registerAllShortcuts(win))
  win.on('blur', () => globalShortcut.unregister(ACCELERATOR))
  win.on('closed', () => globalShortcut.unregister(ACCELERATOR))

  registerAllShortcuts(win)
}
