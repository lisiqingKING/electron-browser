import http from 'node:http'
import https from 'node:https'
import { getSetting } from '../modules/settings/manager'
import { networkLogger as logger } from '../shared/logger'

// 默认 API Key 混淆存储 — 运行时还原，增加静态提取难度
const _k = ['tp-c2c3', '97g9akt', 'qbph1c', 'pe4n9ej', 'royi6o', 'aqjmeeo', 'waflb22', '572n']
function getDefaultApiKey(): string {
  return _k.join('')
}

export function handleAiProxyRequest(url: string, req: http.IncomingMessage, res: http.ServerResponse) {
  const aiPath = url.replace('/proxy/ai/', '')
  const apiUrl = getSetting('ai_api_url') || 'https://token-plan-cn.xiaomimimo.com/v1'
  const apiKey = getSetting('ai_api_key') || getDefaultApiKey()

  if (!apiKey) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: '未配置 AI API Key，请在设置页配置' }))
    return
  }

  // 拼接目标 URL: baseUrl + / + path
  const baseUrl = apiUrl.replace(/\/$/, '')
  const targetUrl = `${baseUrl}/${aiPath}`
  logger.error(`${url} -> ${targetUrl}`)

  const headers = { ...req.headers }
  delete headers.host
  headers['authorization'] = `Bearer ${apiKey}`

  const isHttps = targetUrl.startsWith('https://')
  const requestModule = isHttps ? https : http

  const proxyReq = requestModule.request(targetUrl, {
    method: req.method,
    headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    logger.error('代理错误:', err)
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'AI 代理请求失败' }))
  })

  req.pipe(proxyReq)
}
