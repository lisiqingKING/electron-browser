import http from 'node:http'
import https from 'node:https'
import zlib from 'node:zlib'
import { getSetting } from '../modules/settings/manager'
import { networkLogger as logger } from '../shared/logger'
import { createProvider } from './ai-providers'

function parseSSEEvent(line: string): { event?: string; data?: string } {
  if (line.startsWith('event: ')) return { event: line.slice(7).trim() }
  if (line.startsWith('data: ')) return { data: line.slice(6).trim() }
  return {}
}

function createDecompressStream(proxyRes: http.IncomingMessage): NodeJS.ReadableStream {
  const enc = proxyRes.headers['content-encoding']
  if (enc === 'gzip') return proxyRes.pipe(zlib.createGunzip())
  if (enc === 'deflate') return proxyRes.pipe(zlib.createInflate())
  if (enc === 'br') return proxyRes.pipe(zlib.createBrotliDecompress())
  return proxyRes
}

function setupResponseHeaders(proxyRes: http.IncomingMessage, contentType: string) {
  const headers = { ...proxyRes.headers, 'Content-Type': contentType }
  delete headers['content-encoding']
  return headers
}

export function handleAiProxyRequest(url: string, req: http.IncomingMessage, res: http.ServerResponse) {
  const providerType = getSetting('ai_provider_type') || 'openai'
  const apiKey = getSetting('ai_api_key') || ''

  if (!apiKey) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: '未配置 AI API Key，请在设置页配置' }))
    return
  }

  const provider = createProvider(providerType)
  const baseUrl = (getSetting('ai_api_url') || '').replace(/\/$/, '')

  let bodyStr = ''
  req.on('data', chunk => { bodyStr += chunk })
  req.on('end', () => {
    let requestBody: any = {}
    try {
      requestBody = bodyStr ? JSON.parse(bodyStr) : {}
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      return
    }

    const { url: providerUrl, headers: reqHeaders, body: reqBody } = provider.transformRequest(requestBody)
    const targetUrl = providerUrl.startsWith('http') ? providerUrl : `${baseUrl}${providerUrl}`

    logger.info(`${url} -> ${targetUrl} (provider: ${providerType})`)

    const isHttps = targetUrl.startsWith('https://')
    const requestModule = isHttps ? https : http

    const proxyReq = requestModule.request(targetUrl, {
      method: 'POST',
      headers: reqHeaders
    }, (proxyRes) => {
      const isStreaming = requestBody.stream && providerType === 'anthropic'

      if (isStreaming) {
        const headers = setupResponseHeaders(proxyRes, 'text/event-stream')
        res.writeHead(proxyRes.statusCode!, headers)

        const stream = createDecompressStream(proxyRes)
        let buffer = ''

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop()!

          for (const line of lines) {
            const { data } = parseSSEEvent(line)
            if (!data) continue

            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n')
              continue
            }

            try {
              const parsed = JSON.parse(data)
              const transformed = provider.transformSSEEvent(parsed)
              if (transformed !== null) {
                res.write(`data: ${JSON.stringify(transformed)}\n\n`)
              }
            } catch {
              res.write(`data: ${data}\n\n`)
            }
          }
        })

        stream.on('end', () => { res.end() })
        stream.on('error', (err) => { logger.error('流式响应错误:', err) })
      } else {
        const stream = createDecompressStream(proxyRes)
        let body = ''

        stream.on('data', chunk => { body += chunk })
        stream.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            const transformed = provider.transformResponse(parsed)
            const headers = setupResponseHeaders(proxyRes, 'application/json')
            res.writeHead(proxyRes.statusCode!, headers)
            res.end(JSON.stringify(transformed))
          } catch {
            res.writeHead(proxyRes.statusCode!, proxyRes.headers)
            res.end(body)
          }
        })
      }
    })

    proxyReq.on('error', (err) => {
      logger.error('AI 代理请求失败:', err)
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'AI 代理请求失败' }))
    })

    proxyReq.write(JSON.stringify(reqBody))
    proxyReq.end()
  })
}
