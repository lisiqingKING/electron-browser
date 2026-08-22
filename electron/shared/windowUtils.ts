import { BrowserWindow } from 'electron'

export function getWindowById(id: number | undefined): BrowserWindow | null {
  if (!id) return null
  const win = BrowserWindow.fromId(id)
  return win && !win.isDestroyed() ? win : null
}
