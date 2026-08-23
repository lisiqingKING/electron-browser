import http from 'node:http'
import path from 'node:path'
import { app } from 'electron'
import { handleRequest } from './router'
import { mainLogger as logger } from '../shared/logger'

// ============================================================================
// 状态
// ============================================================================
let server: http.Server | null = null
let serverPort: number = 0

// ============================================================================
// 导出方法
// ============================================================================
export function getSubappUrl(subapp: string, file: string = 'index.html'): string {
  return `http://localhost:${serverPort}/${subapp}/${file}`
}

export async function startSubappServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const appsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'apps')
      : path.join(process.env.APP_ROOT!, '..', 'apps')

    server = http.createServer((req, res) => handleRequest(req, res, appsDir))

    // 开发模式使用固定端口，生产模式随机端口
    const port = app.isPackaged ? 0 : 3456
    server.listen(port, () => {
      const addr = server!.address()
      if (!addr || typeof addr !== 'object') {
        reject(new Error('Failed to get server port'))
        return
      }
      serverPort = addr.port
      logger.info(`[subappServer] 启动成功，端口: ${serverPort}，appsDir: ${appsDir}`)
      resolve(serverPort)
    })

    server.on('error', reject)
  })
}

export function stopSubappServer() {
  server?.close()
  server = null
}