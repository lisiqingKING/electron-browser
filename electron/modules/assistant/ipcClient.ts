// assistant 模块 - 辅助会话（工作区内的第二个 AI）
import { ipcRenderer } from 'electron'

export const assistantChannels = {
  create: 'assistant:create',
  list: 'assistant:list',
  getMessages: 'assistant:getMessages',
  rename: 'assistant:rename',
  deleteSession: 'assistant:deleteSession',
  reorder: 'assistant:reorder',
} as const

export function createAssistantProxy() {
  const proxy: Record<string, (...args: unknown[]) => unknown> = {}
  for (const [method, channel] of Object.entries(assistantChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
  return proxy
}

export type AssistantModule = ReturnType<typeof createAssistantProxy>
