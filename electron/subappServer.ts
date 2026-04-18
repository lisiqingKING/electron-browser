import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

let server: http.Server | null = null
let serverPort: number = 0

export function getSubappUrl(subapp: string, file: string = 'index.html'): string {
  return `http://localhost:${serverPort}/${subapp}/${file}`
}

export async function startSubappServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    // 开发模式用项目根目录的 apps，生产模式用 resourcesPath
    const appsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'apps')
      : path.join(process.env.APP_ROOT!, '..', 'apps')

    server = http.createServer((req, res) => {
      const url = req.url || '/'

      // 处理代理请求 /proxy/https://xxx.com -> 转发到真实 URL
      if (url.startsWith('/proxy/')) {
        const targetUrl = url.replace('/proxy/', '')
        console.log(`[subappServer] 代理请求: ${url} -> ${targetUrl}`)

        const proxyReq = http.request(targetUrl, {
          method: req.method,
          headers: req.headers,
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode!, proxyRes.headers)
          proxyRes.pipe(res)
        })

        proxyReq.on('error', (err) => {
          console.error('[subappServer] 代理错误:', err)
          res.writeHead(502, { 'Content-Type': 'text/plain' })
          res.end('Proxy Error')
        })

        req.pipe(proxyReq)
        return
      }

      // /subapp/path -> appsDir/subapp/path
      const filePath = path.join(appsDir, url)
      console.log(`[subappServer] 请求: ${url} -> 实际路径: ${filePath}`)

      // 安全检查：防止路径遍历
      if (!filePath.startsWith(appsDir)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          console.log(`[subappServer] 文件读取失败: ${err.code} - ${filePath}`)
          if (err.code === 'ENOENT') {
            // 尝试 index.html（SPA 路由支持）
            const indexPath = path.join(path.dirname(filePath), 'index.html')
            fs.readFile(indexPath, (err2, data2) => {
              if (err2) {
                res.writeHead(404)
                res.end('Not Found')
              } else {
                res.writeHead(200)
                res.end(data2)
              }
            })
          } else {
            res.writeHead(500)
            res.end('Server Error')
          }
          return
        }

        // 根据扩展名设置 Content-Type
        const ext = path.extname(filePath).toLowerCase()
        const contentTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        }
        const contentType = contentTypes[ext] || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(data)
      })
    })

    server.listen(0, () => {
      const addr = server!.address()
      if (addr && typeof addr === 'object') {
        serverPort = addr.port
        console.log(`[subappServer] 子应用服务器启动`)
        console.log(`[subappServer] appsDir: ${appsDir}`)
        console.log(`[subappServer] 端口: ${serverPort}`)
        resolve(serverPort)
      } else {
        reject(new Error('Failed to get server port'))
      }
    })

    server.on('error', reject)
  })
}

export function stopSubappServer() {
  if (server) {
    server.close()
    server = null
  }
}
