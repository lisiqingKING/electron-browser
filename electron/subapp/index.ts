import http from 'node:http'
import path from 'node:path'
import { app } from 'electron'
import { handleRequest } from './router'

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

    server.listen(0, () => {
      const addr = server!.address()
      if (!addr || typeof addr !== 'object') {
        reject(new Error('Failed to get server port'))
        return
      }
      serverPort = addr.port
      console.log(`[subappServer] 启动成功，端口: ${serverPort}，appsDir: ${appsDir}`)
      resolve(serverPort)
    })

    server.on('error', reject)
  })
}

export function stopSubappServer() {
  server?.close()
  server = null
}