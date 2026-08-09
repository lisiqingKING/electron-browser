import { BrowserWindow, WebContentsView } from 'electron'
import type { TabInfo } from './types'

export function updateCurTabBounds(
  tab: { info: TabInfo; view: WebContentsView },
  win: BrowserWindow
) {
  const [width, height] = win.getContentSize()
  tab.view.setBounds({
    x: 0,
    y: 96,
    width,
    height: height - 96
  })
}
