import { app } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import log from 'electron-log'
import { init } from './mainEntry'
import { initLoggers } from './shared/logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// 全局异常捕获（尽早注册，确保模块加载阶段的异常也能捕获）
process.on('uncaughtException', (err) => {
  log.error('[uncaughtException]', err.message, err.stack)
})

process.on('unhandledRejection', (reason) => {
  log.error('[unhandledRejection]', reason)
})

app.whenReady().then(async () => {
  // 初始化日志模块（在 app ready 之后，app.getPath('logs') 才可用）
  initLoggers()
  await init()
})
