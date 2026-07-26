import http from 'node:http'
import { handleProxyRequest } from './proxy'
import { handleAiProxyRequest } from './aiProxy'
import { handleFileRequest } from './fileHandler'

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, appsDir: string) {
  const url = req.url || '/'

  if (url.startsWith('/proxy/ai/')) {
    handleAiProxyRequest(url, req, res)
  } else if (url.startsWith('/proxy/')) {
    handleProxyRequest(url, req, res)
  } else {
    handleFileRequest(url, res, appsDir)
  }
}