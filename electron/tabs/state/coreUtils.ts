import { BrowserWindow, WebContentsView } from 'electron'
import { env, PROTOCOL_LSQAPP } from '../../shared/env'
import { getTabContext } from './context'
import type { TabInfo } from './types'
import { updateCurTabBounds } from './tabBounds'
import { createTabView } from './tabCore'
import { registerWebContentsEvents } from '../tabEvents'
import { resolveAppsUrl } from '../tabNavigation'
import { isUrl } from '@renderer/utils'

export const DEFAULT_TAB = {
  title: '首页',
  get url() { return env.getAppUrl() }
}

export function isLocalFile(url: string): boolean {
  return !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')
}

export function isAppUrl(url: string): boolean {
  const devUrl = env.getAppUrl()
  return url.includes(devUrl) || url.includes('localhost') || url.includes('../app/index.html')
}

export function getDomainFromUrl(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol === 'file:' || !hostname) {
      return '本地文件'
    }
    return hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function isInternalUrl(url: string): boolean {
  return url.startsWith(`${PROTOCOL_LSQAPP}://`) || url.startsWith(env.getAppUrl())
}

export function isInternalTab(tab: { info: { url: string; actualUrl?: string } }): boolean {
  const url = tab.info.actualUrl || tab.info.url
  return isInternalUrl(url) || isAppUrl(url)
}

export function findExistingInternalTab(win: BrowserWindow, url: string) {
  const ctx = getTabContext(win)
  return [...ctx.webContentViewMap.values()].find(t => {
    const tabUrl = t.info.url
    if (tabUrl === url) return true
    const getRoute = (u: string) => {
      const hashIndex = u.indexOf('#/')
      return hashIndex !== -1 ? u.slice(hashIndex) : u
    }
    return getRoute(tabUrl) === getRoute(url)
  })
}

export function switchToExistingTab(win: BrowserWindow, existing: { info: TabInfo; view: WebContentsView | null }) {
  const ctx = getTabContext(win)
  const curTab = ctx.curTabId ? ctx.webContentViewMap.get(ctx.curTabId) : null
  if (curTab?.view) win.contentView.removeChildView(curTab.view)

  if (!existing.view) {
    // 懒加载：view 还没创建，需要先创建并加载
    const view = createTabView(existing.info, win)
    registerWebContentsEvents(view, existing.info, win)
    const resolvedUrl = resolveAppsUrl(existing.info.url)
    if (isUrl(resolvedUrl)) {
      view.webContents.loadURL(resolvedUrl)
    } else {
      view.webContents.loadFile(resolvedUrl)
    }
    win.contentView.addChildView(view)
    existing.view = view
  } else {
    win.contentView.addChildView(existing.view)
  }

  updateCurTabBounds(existing, win)
  ctx.curTabId = existing.info.id!

  const canGoBack = existing.view.webContents.canGoBack()
  const canGoForward = existing.view.webContents.canGoForward()
  existing.info.canGoBack = canGoBack
  existing.info.canGoForward = canGoForward
  win.webContents.send('tab:can-navigate', { id: existing.info.id!, canGoBack, canGoForward })
  win.webContents.send('tab:current-changed', { currentTabId: existing.info.id })

  return existing.info.id!
}

const INTERNAL_PAGE_TITLES: Record<string, string> = {
  '': '首页',
  'default': '首页',
  'newtab': '新标签页',
  'ai': 'AI 助手',
  'ai-saves': 'AI 保存记录',
  'history': '历史记录',
  'downloads': '下载管理',
  'logs': '日志查看',
}

export function getTitleForInternalUrl(url: string): string | null {
  if (!isInternalUrl(url)) return null
  try {
    const parsed = new URL(url)
    let route: string
    if (parsed.hash && parsed.hash !== '#/') {
      route = parsed.hash.replace('#/', '')
    } else {
      route = parsed.pathname.slice(1) || ''
    }
    return INTERNAL_PAGE_TITLES[route] || null
  } catch {
    return null
  }
}

export function escapeForJsString(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
