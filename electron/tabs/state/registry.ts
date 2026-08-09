import { BrowserWindow, WebContentsView } from 'electron'
import type { TabInfo } from './types'

export interface TabEntry {
  tabInfo: TabInfo
  view: WebContentsView
  browserWindow: BrowserWindow
}

const tabRegistry = new Map<string, TabEntry>()
const windowTabs = new Map<number, Set<string>>()
const webContentsToWindow = new Map<number, BrowserWindow>()

export function registerTab(tabId: string, entry: TabEntry): void {
  tabRegistry.set(tabId, entry)

  const winId = entry.browserWindow.id
  if (!windowTabs.has(winId)) {
    windowTabs.set(winId, new Set())
  }
  windowTabs.get(winId)!.add(tabId)
  webContentsToWindow.set(entry.view.webContents.id, entry.browserWindow)
}

export function unregisterTab(tabId: string): void {
  const entry = tabRegistry.get(tabId)
  if (entry) {
    const winId = entry.browserWindow.id
    windowTabs.get(winId)?.delete(tabId)
    webContentsToWindow.delete(entry.view.webContents.id)
    tabRegistry.delete(tabId)
  }
}

export function getTabEntry(tabId: string): TabEntry | undefined {
  return tabRegistry.get(tabId)
}

export function getTabBrowserWindow(tabId: string): BrowserWindow | undefined {
  return tabRegistry.get(tabId)?.browserWindow
}

export function getWindowByWebContents(wcId: number): BrowserWindow | undefined {
  return webContentsToWindow.get(wcId)
}

export function getWindowTabIds(winId: number): string[] {
  return [...(windowTabs.get(winId) ?? [])]
}

export function moveTabToWindow(tabId: string, targetWin: BrowserWindow): void {
  const entry = tabRegistry.get(tabId)
  if (!entry) return

  const oldWinId = entry.browserWindow.id
  windowTabs.get(oldWinId)?.delete(tabId)

  entry.browserWindow = targetWin

  if (!windowTabs.has(targetWin.id)) {
    windowTabs.set(targetWin.id, new Set())
  }
  windowTabs.get(targetWin.id)!.add(tabId)
  webContentsToWindow.set(entry.view.webContents.id, targetWin)
}

export function getAllTabs(): TabInfo[] {
  return [...tabRegistry.values()].map(e => e.tabInfo)
}

export function cleanupWindowTabs(winId: number): void {
  const tabIds = windowTabs.get(winId)
  if (tabIds) {
    for (const tabId of tabIds) {
      const entry = tabRegistry.get(tabId)
      if (entry) {
        webContentsToWindow.delete(entry.view.webContents.id)
        tabRegistry.delete(tabId)
      }
    }
    windowTabs.delete(winId)
  }
}
