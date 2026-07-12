/**
 * 内存监控模块
 * - hover 采集：按需采集目标 tab 内存
 * - 生产监控：周期采集所有 tab + 主进程，趋势分析，阈值告警
 */

import { ipcMain } from 'electron'
import { webContentViewMap, getCurTab } from '../tab/tabCore'
import { writeAlertLog } from './alertLogger'

// --------- 类型定义 ---------

interface RendererMemoryInfo {
  id: number
  url: string
  title?: string
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  timestamp: number
}

interface MainProcessMemoryInfo {
  heapUsed: number
  heapTotal: number
  rss: number
  external: number
  arrayBuffers: number
}

type AlertLevel = 'normal' | 'warning' | 'critical'

interface PeriodicSnapshot {
  timestamp: number
  level: AlertLevel
  main: MainProcessMemoryInfo
  renderers: { title: string; usedJSHeapSize: number; totalJSHeapSize: number }[]
  alerts: string[]
}

interface LeakDetectionResult {
  isLeaking: boolean
  growthRate: number
  samples: number
  level: AlertLevel
}

// --------- 阈值配置 ---------

const CONFIG = {
  snapshotInterval: 60_000,       // 60s 采集一次
  maxSnapshots: 100,              // 内存保留最近 100 个快照
  leakThresholdWarning: 1,        // 1 MB/min → 轻微泄漏
  leakThresholdCritical: 5,       // 5 MB/min → 严重泄漏
  alertMainHeapMB: 500,           // 主进程 Heap > 500MB 告警
  alertMainRssMB: 800,            // 主进程 RSS > 800MB 告警
  alertTabHeapMB: 200,            // 任意 tab Heap > 200MB 告警
}

// --------- 监控类 ---------

class MemoryMonitor {
  private snapshots: PeriodicSnapshot[] = []
  private intervalId: NodeJS.Timeout | null = null

  // --- hover 采集 ---

  async collectMemory(targetWcId: number): Promise<RendererMemoryInfo | null> {
    return await this.collectRendererMemory(targetWcId)
  }

  // --- 生产监控 ---

  startMonitor(): void {
    if (this.intervalId) return

    const collect = async () => {
      const main = this.takeMainSnapshot()
      const renderers = await this.collectAllRenderers()
      let { level, alerts } = this.checkThresholds(main, renderers)

      // 泄漏检测
      if (this.snapshots.length >= 10) {
        const trend = this.detectLeak()
        if (trend.isLeaking) {
          const tag = trend.level === 'critical' ? '⚠️ 严重' : '⚡ 轻微'
          const msg = `${tag}泄漏: ${trend.growthRate.toFixed(2)} MB/min (${trend.samples} 个样本)`
          alerts.push(msg)
          if (trend.level === 'critical' && level !== 'critical') {
            level = 'critical'
          }
        }
      }

      const snapshot: PeriodicSnapshot = {
        timestamp: Date.now(),
        level,
        main,
        renderers,
        alerts
      }
      this.snapshots.push(snapshot)
      if (this.snapshots.length > CONFIG.maxSnapshots) {
        this.snapshots.shift()
      }

      this.printSummary(main, renderers)

      // 只有告警才写入日志文件
      if (level !== 'normal') {
        writeAlertLog(snapshot)
      }
    }

    collect()
    this.intervalId = setInterval(collect, CONFIG.snapshotInterval)
    console.log('[MemoryMonitor] 生产监控已启动，采集间隔 60s')
  }

  stopMonitor(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[MemoryMonitor] 监控已停止')
    }
  }

  // --- 内部方法 ---

  private takeMainSnapshot(): MainProcessMemoryInfo {
    const mem = process.memoryUsage()
    return {
      heapUsed: mem.heapUsed / 1024 / 1024,
      heapTotal: mem.heapTotal / 1024 / 1024,
      rss: mem.rss / 1024 / 1024,
      external: mem.external / 1024 / 1024,
      arrayBuffers: mem.arrayBuffers / 1024 / 1024
    }
  }

  private async collectRendererMemory(targetWcId: number): Promise<RendererMemoryInfo | null> {
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

  private async collectAllRenderers(): Promise<PeriodicSnapshot['renderers']> {
    const result: PeriodicSnapshot['renderers'] = []
    for (const [, tab] of webContentViewMap) {
      const wc = tab.view.webContents
      if (wc.isDestroyed()) continue
      try {
        const info = await wc.executeJavaScript(`(() => {
          const m = performance.memory
          if (!m) return null
          return { usedJSHeapSize: m.usedJSHeapSize, totalJSHeapSize: m.totalJSHeapSize }
        })()`)
        if (info) {
          result.push({
            title: tab.info.title || wc.getURL(),
            usedJSHeapSize: info.usedJSHeapSize / 1024 / 1024,
            totalJSHeapSize: info.totalJSHeapSize / 1024 / 1024
          })
        }
      } catch {}
    }
    return result
  }

  private printSummary(main: MainProcessMemoryInfo, renderers: PeriodicSnapshot['renderers']): void {
    const curTab = getCurTab()
    const curRenderer = curTab ? renderers.find(r => r.title === curTab.info.title) : null
    const curInfo = curRenderer ? `${curRenderer.title} ${curRenderer.usedJSHeapSize.toFixed(1)}/${curRenderer.totalJSHeapSize.toFixed(1)} MB` : '无'

    console.log(
      `[MemoryMonitor] 主进程: Heap ${main.heapUsed.toFixed(1)}/${main.heapTotal.toFixed(1)} MB | RSS ${main.rss.toFixed(1)} MB | ` +
      `当前Tab: ${curInfo}`
    )
  }

  private checkThresholds(main: MainProcessMemoryInfo, renderers: PeriodicSnapshot['renderers']): { level: AlertLevel; alerts: string[] } {
    let level: AlertLevel = 'normal'
    const alerts: string[] = []

    if (main.heapUsed > CONFIG.alertMainHeapMB) {
      alerts.push(`主进程 Heap 超限: ${main.heapUsed.toFixed(1)} MB > ${CONFIG.alertMainHeapMB} MB`)
      level = 'critical'
    }
    if (main.rss > CONFIG.alertMainRssMB) {
      alerts.push(`主进程 RSS 超限: ${main.rss.toFixed(1)} MB > ${CONFIG.alertMainRssMB} MB`)
      level = 'critical'
    }

    for (const r of renderers) {
      if (r.usedJSHeapSize > CONFIG.alertTabHeapMB) {
        alerts.push(`Tab "${r.title}" Heap 超限: ${r.usedJSHeapSize.toFixed(1)} MB > ${CONFIG.alertTabHeapMB} MB`)
        if (level !== 'critical') level = 'warning'
      }
    }

    // 输出告警日志
    for (const msg of alerts) {
      console.warn(`[MemoryMonitor] ⚠️ ${msg}`)
    }

    return { level, alerts }
  }

  private detectLeak(): LeakDetectionResult {
    const n = this.snapshots.length
    if (n < 10) {
      return { isLeaking: false, growthRate: 0, samples: n, level: 'normal' }
    }

    const x = Array.from({ length: n }, (_, i) => i)
    const y = this.snapshots.map(s => s.main.heapUsed)

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0)
    const sumX2 = x.reduce((a, xi) => a + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    if (slope > CONFIG.leakThresholdCritical) {
      return { isLeaking: true, growthRate: slope, samples: n, level: 'critical' }
    }
    if (slope > CONFIG.leakThresholdWarning) {
      return { isLeaking: true, growthRate: slope, samples: n, level: 'warning' }
    }
    return { isLeaking: false, growthRate: slope, samples: n, level: 'normal' }
  }
}

// --------- 单例 ---------

let instance: MemoryMonitor | null = null

export function getMemoryMonitor(): MemoryMonitor {
  if (!instance) {
    instance = new MemoryMonitor()
  }
  return instance
}

// --------- IPC 注册 ---------

export function registerMemoryMonitorHandler(): void {
  ipcMain.handle('memory:requestUpdate', async (_event, wcId: number) => {
    return await getMemoryMonitor().collectMemory(wcId)
  })
}
