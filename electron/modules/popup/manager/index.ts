import { app } from 'electron'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { calculatePopupPosition } from './PositionCalculator'
import { detectWindowTheme } from './ThemeDetector'
import {
  createPopupWindow,
  destroyPopupWindow,
  showPopupInactive,
  sendRenderData,
  hidePopupWindow,
  popupSourceMap,
  setPopupWindow,
} from './WindowManager'

function getPopupUrl(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL + 'popup.html'
  }
  return 'file://' + path.join(app.getAppPath(), 'dist', 'popup.html')
}

export interface MenuItem {
  label?: string
  icon?: string
  action?: string
  type?: string
  disabled?: boolean
  separator?: boolean
  children?: MenuItem[]
}

export interface PopupOptions {
  x: number
  y: number
  component: string
  props?: Record<string, unknown>
  width?: number
  height?: number
  context?: unknown
}

export { popupSourceMap }

export function showPopup(options: PopupOptions, targetWin: BrowserWindow): void {
  if (!targetWin || targetWin.isDestroyed()) return

  destroyPopupWindow()

  const contentBounds = targetWin.getContentBounds()
  const favorites = (options.props?.favorites as any[]) || []
  const items = (options.props?.items as any[]) || []
  const itemCount = favorites.length + items.length + 1

  const position = calculatePopupPosition(contentBounds, {
    preferred: { x: options.x, y: options.y },
    size: { width: options.width, height: options.height },
    itemCount,
  })

  const popupWin = createPopupWindow(targetWin)
  setPopupWindow(popupWin)
  popupSourceMap.set(popupWin.webContents.id, targetWin.id)

  const currentPopupId = popupWin.id
  popupWin.webContents.on('did-finish-load', async () => {
    if (popupWin.isDestroyed() || popupWin.id !== currentPopupId) return
    if (targetWin.isDestroyed()) return

    const theme = await detectWindowTheme(targetWin)

    sendRenderData(popupWin, {
      component: options.component,
      props: options.props,
      context: options.context,
      theme,
      x: position.x - contentBounds.x,
      y: position.y - contentBounds.y,
      width: position.width,
      height: position.height,
      windowId: targetWin.id,
    })

    showPopupInactive(popupWin)
  })

  popupWin.loadURL(getPopupUrl())
}

export function hidePopup(): void {
  hidePopupWindow()
}
