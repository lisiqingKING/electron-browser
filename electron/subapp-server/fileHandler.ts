import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

// ============================================================================
// 常量
// ============================================================================
export const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

// ==================== 安全性：Content-Security-Policy ====================
// 防止 XSS 注入。未来若引入外部 CDN，按注释在对应 directive 追加域名：
//   style-src  → 字体 CDN（如 fonts.googleapis.com）
//   font-src   → 字体文件 CDN（如 fonts.gstatic.com）
//   script-src → 第三方 SDK CDN
const HTML_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' http://localhost:* https://*",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

// ============================================================================
// 文件处理
// ============================================================================
export function handleFileRequest(url: string, res: http.ServerResponse, appsDir: string) {
  // /internal-app/settings -> /internal-app/dist/settings
  const urlPath = url.replace(/^\/([^/]+)\//, '/$1/dist/')
  const filePath = path.join(appsDir, urlPath)

  if (!filePath.startsWith(appsDir)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      handleFileError(err, filePath, res)
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'
    const headers: Record<string, string> = { 'Content-Type': contentType }

    if (ext === '.html') {
      headers['Content-Security-Policy'] = HTML_CSP
    }

    res.writeHead(200, headers)
    res.end(data)
  })
}

function handleFileError(err: NodeJS.ErrnoException, filePath: string, res: http.ServerResponse) {
  if (err.code === 'ENOENT') {
    const indexPath = path.join(path.dirname(filePath), 'index.html')
    fs.readFile(indexPath, (err2, data2) => {
      if (err2) {
        res.writeHead(404)
        res.end('Not Found')
      } else {
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Security-Policy': HTML_CSP,
        })
        res.end(data2)
      }
    })
  } else {
    res.writeHead(500)
    res.end('Server Error')
  }
}