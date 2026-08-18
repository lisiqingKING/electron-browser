import { BrowserWindow, WebContentsView } from 'electron'
import type { TabInfo } from './types'

// TabBar(48) + UrlBar(48) + FavoritesQuick(36) = 132
const CONTENT_TOP = 132

export function updateCurTabBounds(
  tab: { info: TabInfo; view: WebContentsView },
  win: BrowserWindow
) {
  const [width, height] = win.getContentSize()
  tab.view.setBounds({
    x: 0,
    y: CONTENT_TOP,
    width,
    height: height - CONTENT_TOP
  })
}
