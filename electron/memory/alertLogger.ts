/**
 * 告警日志模块
 * - 使用 electron-log 写入日志文件
 * - 支持 daily rotation + 单文件大小限制
 * - 单一职责：只负责日志持久化
 */

import log from 'electron-log'
import type { PeriodicSnapshot, AlertHandler } from './memoryMonitor'

// 配置 electron-log 日志切割（超过 maxSize 自动归档旧文件）
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB

// 最近告警缓存（供 IPC 读取）
const recentAlerts: string[] = []
const MAX_RECENT_ALERTS = 100

/**
 * 写入告警日志
 */
function writeAlertLog(snapshot: PeriodicSnapshot): void {
  const time = new Date(snapshot.timestamp).toLocaleString('zh-CN')

  for (const msg of snapshot.alerts) {
    const fullMsg = `${time} | ${msg} | 主进程 Heap ${snapshot.main.heapUsed.toFixed(1)} MB RSS ${snapshot.main.rss.toFixed(1)} MB`

    if (snapshot.level === 'critical') {
      log.error(fullMsg)
    } else {
      log.warn(fullMsg)
    }

    // 缓存到内存（供 IPC 读取）
    recentAlerts.push(fullMsg)
    if (recentAlerts.length > MAX_RECENT_ALERTS) {
      recentAlerts.shift()
    }
  }
}

/**
 * 获取最近告警
 */
export function getRecentAlerts(): string[] {
  return [...recentAlerts]
}

/**
 * 初始化日志模块
 * 返回告警处理器，供外部注入给 memoryMonitor
 */
export function createAlertHandler(): AlertHandler {
  return writeAlertLog
}
