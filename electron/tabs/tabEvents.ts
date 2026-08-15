import { WebContentsView, BrowserWindow } from 'electron'
import contextMenu from 'electron-context-menu'
import { recordVisit } from '../modules/history/historyManager'
import { getOrFetchIcon } from '../modules/icons/iconsManager'
import { getTabContext, TabInfo, createTabCore, updateCurTabBounds, getTabListData, getCurTab } from './state'
import { isAppUrl, isInternalUrl, getDomainFromUrl, getTitleForInternalUrl, escapeForJsString } from './state/coreUtils'
import { updateNavigationState, tryRestoreLoadError, createTabAndShow } from './tabNavigation'
import { isUrl } from '@renderer/utils'
import { env, PROTOCOL_LSQAPP } from '../shared/env'
import { insertTab, updateTabUrl } from './tabsDb'

function getTitleForUrl(tab: { info: { url: string } }, pageTitle: string): string {
  if (isInternalUrl(tab.info.url)) {
    return getTitleForInternalUrl(tab.info.url) || pageTitle || '首页'
  }
  if (isAppUrl(tab.info.url)) {
    return '首页'
  }
  return pageTitle
}

export function registerWebContentsEvents(view: WebContentsView, tabInfo: TabInfo, win: BrowserWindow) {
  const tabId = tabInfo.id!
  const ctx = getTabContext(win)

  view.webContents.setWindowOpenHandler((event) => {
    console.log('[setWindowOpenHandler] 拦截到 window.open, url:', event.url)

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
    registerWebContentsEvents(newView, newTabInfo, win)
    win.contentView.addChildView(newView)
    updateCurTabBounds(ctx.webContentViewMap.get(newTabInfo.id!)!, win)
    insertTab({ title: newTabInfo.title, url: newTabInfo.url, time: newTabInfo.time! })
    win.webContents.send('tab:list-changed', getTabListData(win))

    return { action: 'deny' }
  })

  view.webContents.on('did-start-loading', () => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      tab.info.isLoading = true
      win.webContents.send('tab:loading', { id: tabId, isLoading: true })

      let newTitle: string | null = null
      if (isInternalUrl(tab.info.url)) {
        newTitle = getTitleForInternalUrl(tab.info.url)
      } else if (!isAppUrl(tab.info.url)) {
        newTitle = getDomainFromUrl(tab.info.url)
      }

      if (newTitle && newTitle !== tab.info.title) {
        tab.info.title = newTitle
        win.webContents.send('tab:info-changed', tab.info)
      }
    }
  })

  view.webContents.on('did-stop-loading', () => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      tab.info.isLoading = false
      win.webContents.send('tab:loading', { id: tabId, isLoading: false })
    }
  })

  view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return

    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      console.log('[did-fail-load] URL:', validatedURL, 'Error:', errorCode, errorDescription)

      if (tab.info.loadError) {
        const errorUrl = env.getErrorUrl({
          url: tab.info.loadError.url,
          code: tab.info.loadError.code,
          error: tab.info.loadError.message
        })
        view.webContents.executeJavaScript(`location.replace('${escapeForJsString(errorUrl)}')`)
        return
      }

      const originalUrl = validatedURL
      const originalTitle = getDomainFromUrl(originalUrl) || originalUrl

      tab.info.isLoading = false
      tab.info.url = originalUrl
      tab.info.title = originalTitle
      tab.info.loadError = {
        url: validatedURL,
        code: errorCode,
        message: errorDescription
      }
      win.webContents.send('tab:loading', { id: tabId, isLoading: false })
      win.webContents.send('tab:info-changed', tab.info)

      const errorUrl = env.getErrorUrl({
        url: validatedURL,
        code: errorCode,
        error: errorDescription
      })

      view.webContents.executeJavaScript(`location.replace('${escapeForJsString(errorUrl)}')`)
    }
  })

  view.webContents.on('did-finish-load', () => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      const newUrl = view.webContents.getURL()

      if (tryRestoreLoadError(tab, newUrl)) {
        win.webContents.send('tab:info-changed', tab.info)
        updateNavigationState(tabId, win)
        return
      }

      if (tab.info.loadError) {
        updateNavigationState(tabId, win)
        return
      }

      if (tab.info.url.startsWith(`${PROTOCOL_LSQAPP}://`)) {
        tab.info.actualUrl = newUrl
      } else if (!isAppUrl(tab.info.url)) {
        tab.info.url = newUrl
        tab.info.title = getTitleForUrl(tab, view.webContents.getTitle() || tab.info.title)
        recordVisit(tab.info.title, newUrl, tab.info.favicon)
        updateTabUrl(tabId, newUrl)
        win.webContents.send('tab:info-changed', tab.info)
      }
      updateNavigationState(tabId, win)
    }
  })

  view.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) {
      const tab = ctx.webContentViewMap.get(tabId)
      if (tab) {
        if (tab.info.loadError) return

        if (tab.info.url.startsWith(`${PROTOCOL_LSQAPP}://`)) {
          tab.info.actualUrl = url
        } else {
          tab.info.url = url
        }
        updateNavigationState(tabId, win)
      }
    }
  })

  view.webContents.on('did-navigate', (_event, url) => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      if (tryRestoreLoadError(tab, url)) {
        win.webContents.send('tab:info-changed', tab.info)
        updateNavigationState(tabId, win)
        return
      }

      if (tab.info.loadError) return

      if (tab.info.url.startsWith(`${PROTOCOL_LSQAPP}://`)) {
        tab.info.actualUrl = url
      } else {
        tab.info.url = url
        tab.info.title = getTitleForUrl(tab, view.webContents.getTitle())
      }
      win.webContents.send('tab:info-changed', tab.info)
      updateNavigationState(tabId, win)
    }
  })

  view.webContents.on('page-title-updated', (_event, title) => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      if (tab.info.loadError) return

      const newTitle = getTitleForUrl(tab, title)
      if (newTitle !== tab.info.title) {
        tab.info.title = newTitle
        win.webContents.send('tab:info-changed', tab.info)
      }
    }
  })

  view.webContents.on('page-favicon-updated', async (_event, favicons) => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab && favicons.length > 0) {
      let iconUrl = favicons[0]
      // data: URL 直接使用
      if (iconUrl.startsWith('data:')) {
        tab.info.favicon = iconUrl
        win.webContents.send('tab:info-changed', tab.info)
        return
      }
      // 相对路径转为完整 URL
      if (!iconUrl.startsWith('http://') && !iconUrl.startsWith('https://')) {
        try {
          const pageUrl = view.webContents.getURL()
          const pageOrigin = new URL(pageUrl).origin
          iconUrl = pageOrigin + (iconUrl.startsWith('/') ? iconUrl : '/' + iconUrl)
        } catch {
          // 无法解析 URL，跳过
          return
        }
      }
      // 下载并转为 base64
      const base64Icon = await getOrFetchIcon(tab.info.url, iconUrl)
      if (base64Icon) {
        tab.info.favicon = base64Icon
        win.webContents.send('tab:info-changed', tab.info)
      }
    }
  })

  view.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      if (details.resourceType === 'image' && view.webContents) {
        details.requestHeaders['Referer'] = view.webContents.getURL()
      }
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  contextMenu({
    window: view.webContents,
    menu: (_defaultActions, parameters) => {
      const items: Electron.MenuItemConstructorOptions[] = []

      items.push({ label: '刷新', click: () => view.webContents.reload() })
      items.push({ type: 'separator' })

      if (parameters.isEditable) {
        items.push({ label: '剪切', click: () => view.webContents.cut() })
        items.push({ label: '复制', click: () => view.webContents.copy() })
        items.push({ label: '粘贴', click: () => view.webContents.paste() })
        items.push({ type: 'separator' })
      }

      if (parameters.linkURL) {
        items.push({ label: '复制链接', click: () => view.webContents.copy() })
      }

      if (parameters.mediaType === 'image') {
        items.push({ label: '复制图片', click: () => view.webContents.copyImageAt(parameters.x, parameters.y) })
        if (parameters.srcURL) {
          items.push({ label: '在新标签页打开图片', click: () => createTabAndShow({ title: '图片', url: parameters.srcURL }, win, getCurTab(win)?.info?.id) })
        }
      }

      items.push({ type: 'separator' })
      items.push({ label: '检查元素', click: () => view.webContents.inspectElement(parameters.x, parameters.y) })

      return items
    }
  })
}
