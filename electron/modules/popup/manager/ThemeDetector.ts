import type { BrowserWindow } from 'electron'

export type Theme = 'dark' | 'light'

export async function detectWindowTheme(targetWin: BrowserWindow): Promise<Theme> {
  if (!targetWin || targetWin.isDestroyed()) return 'dark'

  try {
    const isDark = await targetWin.webContents.executeJavaScript(
      'document.documentElement.classList.contains("dark")'
    )
    return isDark ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}
