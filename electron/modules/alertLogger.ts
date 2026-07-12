/**
 * 告警日志模块
 * 使用 electron-log 将内存告警写入日志文件
 */

import { app } from 'electron'
import log from 'electron-log'
import path from 'node:path'

// 配置日志文件路径
log.transports.file.file = path.join(app.getPath('logs'), 'memory-alerts.log')
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'

interface AlertSnapshot {
  timestamp: number
  level: string
  main: { heapUsed: number; heapTotal: number; rss: number }
  renderers: { title: string; usedJSHeapSize: number }[]
  alerts: string[]
}

export function writeAlertLog(snapshot: AlertSnapshot): void {
  const time = new Date(snapshot.timestamp).toLocaleString('zh-CN')

  for (const msg of snapshot.alerts) {
    const fullMsg = `${time} | ${msg} | 主进程 Heap ${snapshot.main.heapUsed.toFixed(1)} MB RSS ${snapshot.main.rss.toFixed(1)} MB`
    if (snapshot.level === 'critical') {
      log.error(fullMsg)
    } else {
      log.warn(fullMsg)
    }
  }
}
