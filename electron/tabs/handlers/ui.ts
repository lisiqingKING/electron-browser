import { WebContentsView, BrowserWindow } from 'electron'
import contextMenu from 'electron-context-menu'
import { getTabContext, getCurTab } from '../state'
import { createTabAndShow } from '../tabNavigation'
import { getOrFetchIcon } from '../../modules/icons/manager'
import { checkFavorite, toggleFavorite, getAllFavorites } from '../../modules/favorites/manager'

export function registerUIHandlers(
  view: WebContentsView,
  tabId: string,
  ctx: ReturnType<typeof getTabContext>,
  safeSend: (channel: string, ...args: any[]) => void,
  win: BrowserWindow
) {
  view.webContents.on('page-favicon-updated', async (_event, favicons) => {
    const tab = ctx.webContentViewMap.get(tabId)
    if (!tab || favicons.length === 0) return

    let iconUrl = favicons[0]
    // data: URL 直接使用
    if (iconUrl.startsWith('data:')) {
      tab.info.favicon = iconUrl
      safeSend('tab:info-changed', tab.info)
      return
    }
    // 相对路径转为完整 URL
    if (!iconUrl.startsWith('http://') && !iconUrl.startsWith('https://')) {
      try {
        const pageUrl = view.webContents.getURL()
        const pageOrigin = new URL(pageUrl).origin
        iconUrl = pageOrigin + (iconUrl.startsWith('/') ? iconUrl : '/' + iconUrl)
      } catch {
        return
      }
    }
    // 下载并转为 base64
    const base64Icon = await getOrFetchIcon(tab.info.url, iconUrl)
    if (base64Icon) {
      tab.info.favicon = base64Icon
      safeSend('tab:info-changed', tab.info)
    }
  })

  contextMenu({
    window: view.webContents,
    menu: (_defaultActions, parameters) => {
      const items: Electron.MenuItemConstructorOptions[] = []
      const currentUrl = ctx.webContentViewMap.get(tabId)?.info.url || ''
      const isFavorited = checkFavorite(currentUrl)

      items.push({ label: '后退', enabled: view.webContents.canGoBack(), click: () => view.webContents.goBack() })
      items.push({ label: '前进', enabled: view.webContents.canGoForward(), click: () => view.webContents.goForward() })
      items.push({ label: '刷新', click: () => view.webContents.reload() })
      items.push({ type: 'separator' })

      if (currentUrl) {
        items.push({
          label: isFavorited ? '取消收藏' : '添加收藏',
          click: () => {
            const tab = ctx.webContentViewMap.get(tabId)
            if (tab) {
              toggleFavorite(currentUrl, tab.info.title || '', tab.info.favicon)
              broadcastFavoritesChanged()
            }
          }
        })
        items.push({ type: 'separator' })
      }

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
          items.push({
            label: '在新标签页打开图片',
            click: () => createTabAndShow({ title: '图片', url: parameters.srcURL }, win, getCurTab(win)?.info?.id)
          })
        }
      }

      items.push({ type: 'separator' })
      items.push({ label: '检查元素', click: () => view.webContents.inspectElement(parameters.x, parameters.y) })

      return items
    }
  })
}

function broadcastFavoritesChanged() {
  const favorites = getAllFavorites()
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send('favorites:changed', favorites)
    }
  }
}
