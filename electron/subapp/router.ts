import http from 'node:http'
import { handleProxyRequest } from './proxy'
import { handleFileRequest } from './fileHandler'

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, appsDir: string) {
  const url = req.url || '/'

  if (url.startsWith('/proxy/')) {
    handleProxyRequest(url, req, res)
  } else {
    handleFileRequest(url, res, appsDir)
  }
}