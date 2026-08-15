import log from 'electron-log'
import path from 'node:path'
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
  for (const module of LOG_MODULES) {
    const logger = (log.create as any)()
    // @ts-ignore - electron-log internal
    logger.transports.file.resolvePathFn = () => {
      return path.join(app.getPath('logs'), module, `${module}-{y}-{m}-{d}.log`)
    }
    logger.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
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
