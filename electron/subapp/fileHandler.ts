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

// ============================================================================
// 文件处理
// ============================================================================
export function handleFileRequest(url: string, res: http.ServerResponse, appsDir: string) {
  const filePath = path.join(appsDir, url)

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
    res.writeHead(200, { 'Content-Type': contentType })
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
        res.writeHead(200)
        res.end(data2)
      }
    })
  } else {
    res.writeHead(500)
    res.end('Server Error')
  }
}