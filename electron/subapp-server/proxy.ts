import http from 'node:http'

export function handleProxyRequest(url: string, req: http.IncomingMessage, res: http.ServerResponse) {
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
}