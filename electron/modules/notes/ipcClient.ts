// notes 模块 - 笔记（工作区内的富文本文档）
import { ipcRenderer } from 'electron'

export const notesChannels = {
  create: 'notes:create',
  list: 'notes:list',
  get: 'notes:get',
  update: 'notes:update',
  delete: 'notes:delete',
  reorder: 'notes:reorder',
} as const

export function createNotesProxy() {
  const proxy: Record<string, (...args: unknown[]) => unknown> = {}
  for (const [method, channel] of Object.entries(notesChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
  return proxy
}

export type NotesModule = ReturnType<typeof createNotesProxy>
