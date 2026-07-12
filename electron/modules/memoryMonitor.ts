/**
 * 内存监控模块
 * hover 时按需采集目标 tab 渲染进程的内存信息
 */

import { ipcMain } from 'electron'
import { webContentViewMap } from '../tab/tabCore'

interface RendererMemoryInfo {
  id: number
  url: string
  title?: string
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  timestamp: number
}

class MemoryMonitor {
  /**
   * 采集指定 webContents 的内存信息
   * 只对目标 tab 执行 executeJavaScript，不遍历其他 tab
   */
  async collectRendererMemory(targetWcId: number): Promise<RendererMemoryInfo | null> {
    for (const [, tab] of webContentViewMap) {
      const wc = tab.view.webContents
      if (wc.isDestroyed() || wc.id !== targetWcId) continue
      try {
        const info = await wc.executeJavaScript(`(() => {
          const m = performance.memory
          if (!m) return null
          return { usedJSHeapSize: m.usedJSHeapSize, totalJSHeapSize: m.totalJSHeapSize, jsHeapSizeLimit: m.jsHeapSizeLimit }
        })()`)
        if (info) {
          return {
            id: wc.id,
            url: wc.getURL(),
            title: tab.info.title,
            usedJSHeapSize: info.usedJSHeapSize / 1024 / 1024,
            totalJSHeapSize: info.totalJSHeapSize / 1024 / 1024,
            jsHeapSizeLimit: info.jsHeapSizeLimit / 1024 / 1024,
            timestamp: Date.now()
          }
        }
      } catch {}
    }
    return null
  }
}

let instance: MemoryMonitor | null = null

export function getMemoryMonitor(): MemoryMonitor {
  if (!instance) {
    instance = new MemoryMonitor()
  }
  return instance
}

export function registerMemoryMonitorHandler(): void {
  ipcMain.handle('memory:requestUpdate', async (_event, wcId: number) => {
    return await getMemoryMonitor().collectRendererMemory(wcId)
  })
}
