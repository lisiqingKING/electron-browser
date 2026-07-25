import { WebContentsView, BrowserWindow, Menu } from 'electron'
import { recordVisit, updateFaviconByTabUrl } from '../history/historyManager'
import { webContentViewMap, getCurTab, TabInfo, createTabCore, updateCurTabBounds, isAppUrl, isInternalUrl, getDomainFromUrl, getTitleForInternalUrl } from './tabCore'
import { updateNavigationState, tryRestoreLoadError } from './tabNavigation'
import { isUrl } from '../../src/utils'
import { env } from '../env'

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

  // window.open 拦截 - 内联 createTabAndShow 逻辑避免循环依赖
  view.webContents.setWindowOpenHandler((event) => {
    console.log('[setWindowOpenHandler] 拦截到 window.open, url:', event.url)

    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const { view: newView, tabInfo: newTabInfo } = createTabCore({ url: event.url, title: '新窗口' })
    if (isUrl(event.url)) {
      newView.webContents.loadURL(event.url)
    } else {
      newView.webContents.loadFile(event.url)
    }
    registerWebContentsEvents(newView, newTabInfo, win)
    win.contentView.addChildView(newView)
    updateCurTabBounds(webContentViewMap.get(newTabInfo.id!)!, win)
    win.webContents.send('tab:list-changed')

    return { action: 'deny' }
  })

  // 加载状态 - 开始
  view.webContents.on('did-start-loading', () => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      // 注意：不在这里清除 loadError
      // 只有用户通过URL栏主动输入时才在 updateCurTabUrl 中清除
      tab.info.isLoading = true
      win.webContents.send('tab:loading', { id: tabId, isLoading: true })

      // 设置加载中的标题
      let newTitle: string | null = null
      if (isInternalUrl(tab.info.url)) {
        // 内部页面（协议 URL 或 dev URL）显示固定标题
        newTitle = getTitleForInternalUrl(tab.info.url)
      } else if (!isAppUrl(tab.info.url)) {
        // 外部 URL 显示域名
        newTitle = getDomainFromUrl(tab.info.url)
      }

      if (newTitle && newTitle !== tab.info.title) {
        tab.info.title = newTitle
        win.webContents.send('tab:info-changed', tab.info)
      }
    }
  })

  // 加载状态 - 结束
  view.webContents.on('did-stop-loading', () => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      tab.info.isLoading = false
      win.webContents.send('tab:loading', { id: tabId, isLoading: false })
    }
  })

  // 页面加载失败
  view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return  // 只处理主框架的加载失败

    const tab = webContentViewMap.get(tabId)
    if (tab) {
      console.log('[did-fail-load] URL:', validatedURL, 'Error:', errorCode, errorDescription)

      // 如果 loadError 已存在，说明是刷新触发的，重新加载错误页面
      if (tab.info.loadError) {
        const errorUrl = env.getErrorUrl({
          url: tab.info.loadError.url,
          code: tab.info.loadError.code,
          error: tab.info.loadError.message
        })
        const safeUrl = errorUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        view.webContents.executeJavaScript(`location.replace('${safeUrl}')`)
        return
      }

      // validatedURL 是用户请求的原始 URL（非重定向后的 URL）
      const originalUrl = validatedURL
      const originalTitle = getDomainFromUrl(originalUrl) || originalUrl

      // 更新 tab 状态，保持原始访问 URL
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

      // 加载子应用错误页面
      const errorUrl = env.getErrorUrl({
        url: validatedURL,
        code: errorCode,
        error: errorDescription
      })

      // 注入脚本：用 location.replace 加载错误页面（不添加新的历史记录条目）
      const safeErrorUrl = errorUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      view.webContents.executeJavaScript(`location.replace('${safeErrorUrl}')`)
    }
  })

  // 页面加载完成
  view.webContents.on('did-finish-load', () => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      const newUrl = view.webContents.getURL()

      // 检测是否是错误页面 URL（用户后退再前进时会重新加载错误页面）
      if (tryRestoreLoadError(tab, newUrl)) {
        win.webContents.send('tab:info-changed', tab.info)
        updateNavigationState(tabId, win)
        return
      }

      // 加载失败时，不更新 URL 和标题（保留用户访问的原始 URL）
      if (tab.info.loadError) {
        updateNavigationState(tabId, win)
        return
      }

      if (tab.info.url.startsWith('lsqapp://')) {
        // 协议 URL 不更新，显示用 url，实际加载用 actualUrl
        tab.info.actualUrl = newUrl
        // 不记录内部协议到历史记录
      } else if (!isAppUrl(tab.info.url)) {
        tab.info.url = newUrl
        tab.info.title = getTitleForUrl(tab, view.webContents.getTitle() || tab.info.title)
        recordVisit(tab.info.title, newUrl, tab.info.favicon)
        win.webContents.send('tab:info-changed', tab.info)
      }
      updateNavigationState(tabId, win)
    }
  })

  // SPA 内部导航
  view.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) {
      const tab = webContentViewMap.get(tabId)
      if (tab) {
        // 加载失败时不更新 URL（保留用户访问的原始 URL）
        if (tab.info.loadError) return

        if (tab.info.url.startsWith('lsqapp://')) {
          tab.info.actualUrl = url
        } else {
          tab.info.url = url
        }
        updateNavigationState(tabId, win)
      }
    }
  })

  // 普通导航
  view.webContents.on('did-navigate', (_event, url) => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      // 检测是否是错误页面 URL（用户后退再前进时会重新加载错误页面）
      if (tryRestoreLoadError(tab, url)) {
        win.webContents.send('tab:info-changed', tab.info)
        updateNavigationState(tabId, win)
        return
      }

      // 加载失败时不更新 URL 和标题（保留用户访问的原始 URL）
      if (tab.info.loadError) return

      if (tab.info.url.startsWith('lsqapp://')) {
        tab.info.actualUrl = url
      } else {
        tab.info.url = url
        tab.info.title = getTitleForUrl(tab, view.webContents.getTitle())
      }
      win.webContents.send('tab:info-changed', tab.info)
      updateNavigationState(tabId, win)
    }
  })

  // 页面标题更新
  view.webContents.on('page-title-updated', (_event, title) => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      // 加载失败时不更新标题，保留原始 URL 作为标题
      if (tab.info.loadError) return

      const newTitle = getTitleForUrl(tab, title)
      if (newTitle !== tab.info.title) {
        tab.info.title = newTitle
        win.webContents.send('tab:info-changed', tab.info)
      }
    }
  })

  // 获取 favicon
  view.webContents.on('page-favicon-updated', (_event, favicons) => {
    const tab = webContentViewMap.get(tabId)
    if (tab && favicons.length > 0) {
      tab.info.favicon = favicons[0]
      updateFaviconByTabUrl(tab.info.url, favicons[0])
      win.webContents.send('tab:info-changed', tab.info)
    }
  })

  // 为图片请求自动添加 Referer 头（模拟 Chrome 行为）
  view.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      if (details.resourceType === 'image') {
        details.requestHeaders['Referer'] = view.webContents.getURL()
      }
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  // 右键菜单
  view.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    if (params.isEditable) {
      menuItems.push({ label: '剪切', role: 'cut' })
      menuItems.push({ label: '复制', role: 'copy' })
      menuItems.push({ label: '粘贴', role: 'paste' })
      menuItems.push({ type: 'separator' })
    }

    menuItems.push(
      { label: '刷新', role: 'reload' },
      { label: '开发者工具', click: () => view.webContents.openDevTools() }
    )

    const menu = Menu.buildFromTemplate(menuItems)
    menu.popup()
  })
}