import { type WebContents } from 'electron'
import { getAllWindows } from '../windows/windowManager'
import { getTabContext } from '../tabs/state'
import { popupWindow } from '../modules/popup/manager/WindowManager'

// 把事件广播给所有 webContents:
//   - 每个 BrowserWindow (主窗口容器 UI 那个 + 未来多窗口)
//   - 每个 WebContentsView (每个 tab 内子应用)
//   - popup 窗口
// webContents 已销毁 / 枚举中被关都静默忽略, 不抛错.
// payload 缺省时调 send(channel), 否则 send(channel, payload).
export function broadcast(channel: string, payload?: unknown): void {
  for (const win of getAllWindows()) {
    if (win.isDestroyed()) continue
    sendTo(win.webContents, channel, payload)
    const ctx = getTabContext(win)
    for (const [, tab] of ctx.webContentViewMap) {
      if (!tab.view?.webContents) continue
      sendTo(tab.view.webContents, channel, payload)
    }
  }

  // 发送给 popup 窗口
  if (popupWindow && !popupWindow.isDestroyed()) {
    sendTo(popupWindow.webContents, channel, payload)
  }
}

function sendTo(wc: WebContents, channel: string, payload?: unknown): void {
  if (wc.isDestroyed()) return
  try {
    if (payload === undefined) wc.send(channel)
    else wc.send(channel, payload)
  } catch {
    // webContents 在枚举过程中被销毁
  }
}
