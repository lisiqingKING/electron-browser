/**
 * 内存监控模块
 *
 * 分层采集架构：
 * - 常态轮询(60s)：仅采集主进程 process.memoryUsage()，零开销
 * - 当主进程Heap/RSS增量超出阈值 → 触发全Tab深度采集（通过 app.getAppMetrics）；无异常则复用旧Tab数据
 *
 * 采集方式：
 * - 主进程：process.memoryUsage()（Node.js 原生）
 * - 渲染进程：app.getAppMetrics()（Electron 原生，OS 级数据，零 IPC 开销）
 *
 * 解耦设计：
 * - 通过依赖注入与日志模块解耦
 * - memoryMonitor 不依赖任何具体实现，只依赖接口
 */

import { ipcMain, app } from 'electron'
import { memoryConfig } from './memoryConfig'
import { getAllWindows } from '../../windows/windowManager'
import { getTabContext, getCurTab } from '../../tabs/state'
import { mainLogger as logger } from '../logger'

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

export interface PeriodicSnapshot {
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

interface MonitorStats {
  totalCollections: number
  totalCollectionTime: number
  failedCollections: number
}

// --------- 依赖注入接口 ---------

export interface AlertHandler {
  (snapshot: PeriodicSnapshot): void
}

// --------- 监控类 ---------

class MemoryMonitor {
  private snapshots: PeriodicSnapshot[] = []
  private intervalId: NodeJS.Timeout | null = null
  private lastMainSnapshot: MainProcessMemoryInfo | null = null
  private lastRendererSnapshot: PeriodicSnapshot['renderers'] = []
  private enabled = true

  private stats: MonitorStats = {
    totalCollections: 0,
    totalCollectionTime: 0,
    failedCollections: 0,
  }

  private alertHandler: AlertHandler | null = null

  setAlertHandler(handler: AlertHandler): void {
    this.alertHandler = handler
  }

  // --- hover 采集 ---

  collectMemory(targetWcId: number): RendererMemoryInfo | null {
    return this.collectRendererMemory(targetWcId)
  }

  // --- 生产监控 ---

  startMonitor(): void {
    if (this.intervalId) return

    const collect = () => {
      if (!this.enabled) return

      const startTime = Date.now()

      try {
        const main = this.takeMainSnapshot()

        // 判断是否需要 Tab 深采集
        let needTabCollect = false
        let tabDeltaInfo = ''
        if (!this.lastMainSnapshot) {
          needTabCollect = true
        } else {
          const heapDelta = main.heapUsed - this.lastMainSnapshot.heapUsed
          const rssDelta = main.rss - this.lastMainSnapshot.rss
          if (heapDelta > memoryConfig.tabCollectHeapDeltaMB || rssDelta > memoryConfig.tabCollectRssDeltaMB) {
            needTabCollect = true
            tabDeltaInfo = ` (Heap +${heapDelta.toFixed(0)}MB, RSS +${rssDelta.toFixed(0)}MB)`
          }
        }

        let renderers = this.lastRendererSnapshot
        if (needTabCollect) {
          renderers = this.collectAllRenderers()
          this.findBiggestGrowth(renderers)
        }

        this.lastMainSnapshot = main
        this.lastRendererSnapshot = renderers

        let { level, alerts } = this.checkThresholds(main, renderers)

        // 单次内存突增检测
        const spikeResult = this.detectMemorySpike(main)
        if (spikeResult) {
          alerts.push(spikeResult)
          if (level !== 'critical') level = 'warning'
        }

        // 泄漏检测（线性回归）
        let leakTrend: LeakDetectionResult | null = null
        if (this.snapshots.length >= memoryConfig.minSamplesForLeak) {
          leakTrend = this.detectLeak()
          if (leakTrend.isLeaking) {
            const tag = leakTrend.level === 'critical' ? '严重' : '轻微'
            const msg = `${tag}泄漏: ${leakTrend.growthRate.toFixed(2)} MB/min (${leakTrend.samples} 个样本)`
            alerts.push(msg)
            if (leakTrend.level === 'critical' && level !== 'critical') {
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
        if (this.snapshots.length > memoryConfig.maxSnapshots) {
          this.snapshots.shift()
        }

        this.printSummary(main, renderers, tabDeltaInfo)

        // 只有告警才调用处理器
        if (level !== 'normal' && this.alertHandler) {
          this.alertHandler(snapshot)
        }
      } catch (err) {
        logger.error('采集异常:', err)
        this.stats.failedCollections++
      } finally {
        this.stats.totalCollections++
        this.stats.totalCollectionTime += Date.now() - startTime
      }
    }

    collect()
    this.intervalId = setInterval(collect, memoryConfig.snapshotInterval)
    console.log(`[MemoryMonitor] 生产监控已启动，采集间隔 ${memoryConfig.snapshotInterval / 1000}s`)
  }

  stopMonitor(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[MemoryMonitor] 监控已停止')
    }
  }

  enable(): void {
    this.enabled = true
    if (!this.intervalId) {
      this.startMonitor()
    }
    console.log('[MemoryMonitor] 已启用')
  }

  disable(): void {
    this.enabled = false
    this.stopMonitor()
    console.log('[MemoryMonitor] 已禁用')
  }

  isEnabled(): boolean {
    return this.enabled
  }

  getStats(): MonitorStats {
    return { ...this.stats }
  }

  getRecentSnapshots(count: number = 10): PeriodicSnapshot[] {
    return this.snapshots.slice(-count)
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

  private collectRendererMemory(targetWcId: number): RendererMemoryInfo | null {
    const metrics = app.getAppMetrics().filter(m => m.type === 'Tab')
    for (const win of getAllWindows()) {
      if (win.isDestroyed()) continue
      const ctx = getTabContext(win)
      for (const [, tab] of ctx.webContentViewMap) {
        if (!tab.view) continue
        const wc = tab.view.webContents
        if (wc.isDestroyed() || wc.id !== targetWcId) continue
        const pid = wc.getOSProcessId()
        const proc = metrics.find(m => m.pid === pid)
        if (proc) {
          return {
            id: wc.id,
            url: wc.getURL(),
            title: tab.info.title,
            usedJSHeapSize: (proc.memory.privateBytes ?? proc.memory.workingSetSize) / 1024,
            totalJSHeapSize: proc.memory.workingSetSize / 1024,
            jsHeapSizeLimit: 0,
            timestamp: Date.now()
          }
        }
      }
    }
    return null
  }

  private collectAllRenderers(): PeriodicSnapshot['renderers'] {
    const metrics = app.getAppMetrics().filter(m => m.type === 'Tab')
    const result: PeriodicSnapshot['renderers'] = []

    for (const win of getAllWindows()) {
      if (win.isDestroyed()) continue
      const ctx = getTabContext(win)
      for (const [, tab] of ctx.webContentViewMap) {
        if (!tab.view) continue
        const wc = tab.view.webContents
        if (wc.isDestroyed()) continue
        try {
          const pid = wc.getOSProcessId()
          const proc = metrics.find(m => m.pid === pid)
          if (proc) {
            result.push({
              title: tab.info.title || wc.getURL(),
              usedJSHeapSize: (proc.memory.privateBytes ?? proc.memory.workingSetSize) / 1024,
              totalJSHeapSize: proc.memory.workingSetSize / 1024
            })
          }
        } catch {
          // 单个 Tab 采集失败不影响整体
        }
      }
    }
    return result
  }

  private printSummary(main: MainProcessMemoryInfo, renderers: PeriodicSnapshot['renderers'], tabDeltaInfo: string = ''): void {
    const wins = getAllWindows()
    const focusedWin = wins.find(w => w.isFocused()) ?? wins[0]
    const curTab = focusedWin ? getCurTab(focusedWin) : null
    const curRenderer = curTab ? renderers.find(r => r.title === curTab.info.title) : null
    const curInfo = curRenderer ? `${curRenderer.title} 内存${curRenderer.totalJSHeapSize.toFixed(1)}MB` : '无'

    logger.error(
      `主进程: Heap ${main.heapUsed.toFixed(1)}/${main.heapTotal.toFixed(1)} MB | RSS ${main.rss.toFixed(1)} MB${tabDeltaInfo} | ` +
      `当前Tab: ${curInfo}`
    )
  }

  private findBiggestGrowth(current: PeriodicSnapshot['renderers']): void {
    if (this.lastRendererSnapshot.length === 0) return

    let maxGrowth = 0
    let maxGrowthTab = ''

    for (const curr of current) {
      const prev = this.lastRendererSnapshot.find(p => p.title === curr.title)
      if (prev) {
        const growth = curr.usedJSHeapSize - prev.usedJSHeapSize
        if (growth > maxGrowth) {
          maxGrowth = growth
          maxGrowthTab = curr.title
        }
      }
    }

    if (maxGrowth > 10) {
      console.log(`[MemoryMonitor] Tab "${maxGrowthTab}" 增长最多: +${maxGrowth.toFixed(1)} MB`)
    }
  }

  private checkThresholds(main: MainProcessMemoryInfo, renderers: PeriodicSnapshot['renderers']): { level: AlertLevel; alerts: string[] } {
    let level: AlertLevel = 'normal'
    const alerts: string[] = []

    if (main.heapUsed > memoryConfig.alertMainHeapMB) {
      alerts.push(`主进程 Heap 超限: ${main.heapUsed.toFixed(1)} MB > ${memoryConfig.alertMainHeapMB} MB`)
      level = 'critical'
    }
    if (main.rss > memoryConfig.alertMainRssMB) {
      alerts.push(`主进程 RSS 超限: ${main.rss.toFixed(1)} MB > ${memoryConfig.alertMainRssMB} MB`)
      level = 'critical'
    }

    for (const r of renderers) {
      if (r.usedJSHeapSize > memoryConfig.alertTabHeapMB) {
        alerts.push(`Tab "${r.title}" 私有内存超限: ${r.usedJSHeapSize.toFixed(1)} MB > ${memoryConfig.alertTabHeapMB} MB`)
        if (level !== 'critical') level = 'warning'
      }
    }

    for (const msg of alerts) {
      logger.error(msg)
    }

    return { level, alerts }
  }

  private detectMemorySpike(main: MainProcessMemoryInfo): string | null {
    if (!this.lastMainSnapshot) return null

    const heapDelta = main.heapUsed - this.lastMainSnapshot.heapUsed
    const rssDelta = main.rss - this.lastMainSnapshot.rss

    if (heapDelta > memoryConfig.tabCollectHeapDeltaMB * 3) {
      return `单次 Heap 突增: +${heapDelta.toFixed(1)} MB`
    }
    if (rssDelta > memoryConfig.tabCollectRssDeltaMB * 3) {
      return `单次 RSS 突增: +${rssDelta.toFixed(1)} MB`
    }

    return null
  }

  private detectLeak(): LeakDetectionResult {
    const n = this.snapshots.length
    if (n < memoryConfig.minSamplesForLeak) {
      return { isLeaking: false, growthRate: 0, samples: n, level: 'normal' }
    }

    const x = Array.from({ length: n }, (_, i) => i)
    const y = this.snapshots.map(s => s.main.heapUsed)

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0)
    const sumX2 = x.reduce((a, xi) => a + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    if (slope > memoryConfig.leakThresholdCritical) {
      return { isLeaking: true, growthRate: slope, samples: n, level: 'critical' }
    }
    if (slope > memoryConfig.leakThresholdWarning) {
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
    return getMemoryMonitor().collectMemory(wcId)
  })

  ipcMain.handle('memory:getStats', () => {
    return getMemoryMonitor().getStats()
  })

  ipcMain.handle('memory:getSnapshots', (_event, count?: number) => {
    return getMemoryMonitor().getRecentSnapshots(count)
  })

  ipcMain.handle('memory:toggle', (_event, enabled: boolean) => {
    const monitor = getMemoryMonitor()
    if (enabled) {
      monitor.enable()
    } else {
      monitor.disable()
    }
    return monitor.isEnabled()
  })
}
