import log from 'electron-log'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

export const LOG_MODULES = ['main', 'render', 'network', 'ipc', 'sql'] as const
export type LogModule = typeof LOG_MODULES[number]

// 五个独立 logger 实例，初始化后填入
const moduleLoggers: Record<LogModule, typeof log> = {} as Record<LogModule, typeof log>

// 预建各模块 logger 导出（初始化后可用）
export let mainLogger: typeof log = log
export let ipcLogger: typeof log = log
export let sqlLogger: typeof log = log
export let renderLogger: typeof log = log
export let networkLogger: typeof log = log

/**
 * 初始化所有模块 logger（main.ts 启动时调用一次）
 * 每个模块路由到 logs/{module}/{module}-{date}.log
 */
export function initLoggers(): void {
  // dev 模式下文件日志级别为 info，生产环境为 warn
  const fileLevel = app.isPackaged ? 'warn' : 'info'

  for (const module of LOG_MODULES) {
    const logger = (log.create as any)()

    // 确保日志目录存在
    const logDir = path.join(app.getPath('logs'), module)
    try {
      fs.mkdirSync(logDir, { recursive: true })
    } catch {}

    // @ts-ignore - electron-log internal
    // electron-log 的 resolvePathFn 不解析 {y}/{m}/{d} 模板，需手动替换
    const now = new Date()
    const y = String(now.getFullYear())
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const fileName = `${module}-${y}-${m}-${d}.log`

    logger.transports.file.resolvePathFn = () => {
      return path.join(logDir, fileName)
    }
    logger.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
    logger.transports.file.level = fileLevel
    moduleLoggers[module] = logger
  }
  mainLogger = moduleLoggers.main
  ipcLogger = moduleLoggers.ipc
  sqlLogger = moduleLoggers.sql
  renderLogger = moduleLoggers.render
  networkLogger = moduleLoggers.network
}

// 保留原始 log 供全局异常捕获等场景
export { log }
