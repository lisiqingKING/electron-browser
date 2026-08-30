import { WebContentsView, BrowserWindow } from 'electron'
import { getTabContext, TabInfo } from '../state'
import { registerSecurityHandlers, setRegisterEventsFn } from './security'
import { registerStabilityHandlers } from './stability'
import { registerNavigationHandlers } from './navigation'
import { registerUIHandlers } from './ui'

export function registerWebContentsEvents(view: WebContentsView, tabInfo: TabInfo, win: BrowserWindow) {
  const tabId = tabInfo.id!
  const ctx = getTabContext(win)

  const safeSend = (channel: string, ...args: any[]) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  registerSecurityHandlers(view, ctx, safeSend, win)
  registerStabilityHandlers(view, tabId, ctx, safeSend)
  registerNavigationHandlers(view, tabId, ctx, safeSend, win)
  registerUIHandlers(view, tabId, ctx, safeSend, win)
}

// 注入自身引用，避免 security 循环依赖
setRegisterEventsFn(registerWebContentsEvents)
