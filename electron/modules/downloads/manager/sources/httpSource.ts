import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import type { DownloadTask } from '../task'

// HTTP/HTTPS 下载, Range 续传, POST, AbortController 取消.
// 调度器 (downloadScheduler) 决定并发, 本文件只负责单个任务的 I/O 生命周期.
export async function downloadHttpTask(
  task: DownloadTask,
  signal: AbortSignal,
  onProgress: (delta: number, total: number | null) => void
): Promise<{ totalBytes: number | null }> {
  const outputPath = path.join(task.saveDir, task.filename)
  const startOffset = task.receivedBytes
  const headers: Record<string, string> = { ...task.headers }
  if (startOffset > 0) headers['Range'] = `bytes=${startOffset}-`
  if (task.referrer) headers['Referer'] = task.referrer
  if (task.method === 'POST' && task.postBody && !headers['Content-Length']) {
    headers['Content-Length'] = Buffer.byteLength(task.postBody).toString()
  }

  const u = new URL(task.url)
  const lib = u.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = lib.request(
      task.url,
      { method: task.method, headers },
      (res) => {
        // 416: Range 不支持, 服务器拒绝续传. reject 走 failed 分支, 用户可手动重试全量下载.
        if (res.statusCode === 416) {
          res.resume()
          return reject(new Error('range-not-supported'))
        }
        // startOffset > 0 时拿 200 = 服务器忽略 Range, 全量响应. 把已有 partial 当废, 改写覆盖.
        const resuming = startOffset > 0
        const serverIgnoredRange = resuming && res.statusCode === 200
        const writeFlags = serverIgnoredRange || !resuming ? 'w' : 'a'
        if (serverIgnoredRange) {
          task.resetReceivedBytes()
        }
        const writeStream = fs.createWriteStream(outputPath, { flags: writeFlags })
        let bytesThisResponse = 0
        const totalFromHeader = parseContentRangeTotal(res, resuming)
        res.on('data', (chunk: Buffer) => {
          bytesThisResponse += chunk.length
          onProgress(chunk.length, totalFromHeader)
        })
        res.on('error', (err) => {
          writeStream.destroy()
          reject(err)
        })
        writeStream.on('error', (err) => {
          res.destroy()
          reject(err)
        })
        writeStream.on('finish', () => {
          if (totalFromHeader != null) {
            resolve({ totalBytes: totalFromHeader })
          } else {
            resolve({ totalBytes: startOffset + bytesThisResponse })
          }
        })
        res.pipe(writeStream)
      }
    )

    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ABORT_ERR' || signal.aborted) {
        reject(new Error('aborted'))
        return
      }
      reject(err)
    })

    signal.addEventListener('abort', () => {
      req.destroy(new Error('aborted'))
    })

    if (task.method === 'POST' && task.postBody) {
      req.write(task.postBody)
    }
    req.end()
  })
}

// 从 Content-Range 头解析总字节数 (格式: "bytes start-end/total")
function parseContentRangeTotal(res: http.IncomingMessage, resuming: boolean): number | null {
  const contentRange = res.headers['content-range']
  if (contentRange) {
    const m = /\/(\d+)/.exec(contentRange)
    if (m) return Number(m[1])
  }
  // 非续传场景下 content-length 就是 total
  if (!resuming) {
    const cl = res.headers['content-length']
    if (cl) return Number(cl)
  }
  return null
}
