import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { app } from 'electron'
import { calculateAssistantPosition } from './PositionCalculator'

const assistantWindows = new Map<number, BrowserWindow>()

function getPreloadPath(): string {
  return path.join(process.env.APP_ROOT!, 'dist-electron', 'preload.js')
}

function buildAssistantUrl(windowId: number, convId?: string): string {
  const base = process.env.VITE_DEV_SERVER_URL
    ? process.env.VITE_DEV_SERVER_URL + 'assistant.html'
    : 'file://' + path.join(app.getAppPath(), 'dist', 'assistant.html')
  const params = new URLSearchParams()
  params.set('windowId', String(windowId))
  if (convId) params.set('convId', convId)
  return `${base}?${params.toString()}`
}

export function createAssistantWindow(x: number, y: number, convId?: string, parentWebContents?: Electron.WebContents): BrowserWindow {
  closeAllAssistantWindows()

  const primaryDisplay = screen.getPrimaryDisplay()
  const screenBounds = primaryDisplay.bounds

  const position = calculateAssistantPosition(screenBounds, { x, y })

  const win = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0b',
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
    },
  })

  assistantWindows.set(win.id, win)

  win.on('closed', () => {
    assistantWindows.delete(win.id)
  })

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) {
      win.show()
    }
  })

  if (parentWebContents) {
    parentWebContents.on('focus', () => {
      if (!win.isDestroyed()) win.show()
    })
    parentWebContents.on('blur', () => {
      if (!win.isDestroyed()) win.hide()
    })
  }

  win.loadURL(buildAssistantUrl(win.id, convId))

  return win
}

export function closeAllAssistantWindows(): void {
  for (const win of assistantWindows.values()) {
    if (!win.isDestroyed()) {
      win.destroy()
    }
  }
  assistantWindows.clear()
}

export function closeAssistantWindow(windowId: number): void {
  const win = assistantWindows.get(windowId)
  if (win && !win.isDestroyed()) {
    win.destroy()
  }
  assistantWindows.delete(windowId)
}

export function getAssistantWindow(windowId: number): BrowserWindow | undefined {
  return assistantWindows.get(windowId)
}

export function getAllAssistantWindows(): Map<number, BrowserWindow> {
  return assistantWindows
}
