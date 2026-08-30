import { WebContentsView, BrowserWindow } from 'electron'
import { getTabContext, createTabCore, updateCurTabBounds, getTabListData, getCurTab } from '../state'
import type { TabInfo } from '../state/types'
import { isUrl } from '@renderer/utils'
import { mainLogger as logger } from '../../shared/logger'

// webRequest 监听器只在 session 级别注册一次，防止重复注册
const registeredWebRequestViews = new WeakSet<WebContentsView>()

// 避免循环依赖：动态注册 registerWebContentsEvents 引用
let registerEventsFn: ((view: WebContentsView, tabInfo: TabInfo, win: BrowserWindow) => void) | null = null
export function setRegisterEventsFn(fn: typeof registerEventsFn) {
  registerEventsFn = fn
}

export function registerSecurityHandlers(
  view: WebContentsView,
  ctx: ReturnType<typeof getTabContext>,
  safeSend: (channel: string, ...args: any[]) => void,
  win: BrowserWindow
) {
  // 阻止 window.open 触发危险协议
  view.webContents.setWindowOpenHandler((event) => {
    if (/^(\s*javascript\s*:|\s*data\s*:)/i.test(event.url)) {
      logger.warn('[tab] Blocked dangerous URL from window.open:', event.url)
      return { action: 'deny' }
    }

    if (win.isDestroyed()) return { action: 'deny' }

    const curTab = getCurTab(win)
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const afterTabId = curTab?.info?.id
    const { view: newView, tabInfo: newTabInfo } = createTabCore({ url: event.url, title: '新窗口' }, win, afterTabId)
    if (!newView) {
      return { action: 'deny' }
    }
    if (isUrl(event.url)) {
      newView.webContents.loadURL(event.url)
    } else {
      newView.webContents.loadFile(event.url)
    }
    if (registerEventsFn) {
      registerEventsFn(newView, newTabInfo, win)
    }
    win.contentView.addChildView(newView)
    updateCurTabBounds(ctx.webContentViewMap.get(newTabInfo.id!)!, win)
    safeSend('tab:list-changed', getTabListData(win))

    return { action: 'deny' }
  })

  // 拦截危险 URL 导航
  view.webContents.on('will-navigate', (event, url) => {
    const lower = url.toLowerCase()
    if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
      logger.warn('[tab] Blocked dangerous URL:', url)
      event.preventDefault()
    }
  })

  // Referer 重写：同一 session 只注册一次
  if (!registeredWebRequestViews.has(view)) {
    registeredWebRequestViews.add(view)
    view.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ['*://*/*'] },
      (details, callback) => {
        if (details.resourceType === 'image' && view.webContents) {
          details.requestHeaders['Referer'] = view.webContents.getURL()
        }
        callback({ requestHeaders: details.requestHeaders })
      }
    )
  }
}
