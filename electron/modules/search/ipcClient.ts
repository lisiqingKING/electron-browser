// search 模块 - 跨工作区全文搜索（笔记 + 对话消息）
import { ipcRenderer } from 'electron'

export const searchChannels = {
  query: 'search:query',
} as const

export function createSearchProxy() {
  const proxy: Record<string, (...args: unknown[]) => unknown> = {}
  for (const [method, channel] of Object.entries(searchChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
  return proxy
}

export type SearchModule = ReturnType<typeof createSearchProxy>
