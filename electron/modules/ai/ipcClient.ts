// ai 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'

export const aiChannels = {
  list: 'ai:list',
  create: 'ai:create',
  updateTitle: 'ai:updateTitle',
  getMessages: 'ai:getMessages',
  delete: 'ai:delete',
  updatePinned: 'ai:updatePinned',
  getModel: 'ai:getModel',
  getActiveProfile: 'ai:getActiveProfile',
  listProfiles: 'ai:listProfiles',
  saveProfile: 'ai:saveProfile',
  setActiveProfile: 'ai:setActiveProfile',
  deleteProfile: 'ai:deleteProfile',
  listSystemPrompts: 'ai:listSystemPrompts',
  saveSystemPrompt: 'ai:saveSystemPrompt',
  deleteSystemPrompt: 'ai:deleteSystemPrompt',
  getSystemPromptsByIds: 'ai:getSystemPromptsByIds',
  saveFile: 'ai:saveFile',
  openSaveDir: 'ai:openSaveDir',
  listSaveFiles: 'ai:listSaveFiles',
  readSaveFile: 'ai:readSaveFile',
  deleteSaveFile: 'ai:deleteSaveFile',
  chat: 'ai:chat',
  abort: 'ai:abort',
  // Category（目录）
  listCategories: 'ai:listCategories',
  createCategory: 'ai:createCategory',
  renameCategory: 'ai:renameCategory',
  deleteCategory: 'ai:deleteCategory',
  deleteCategoryWithSessions: 'ai:deleteCategoryWithSessions',
  reorderCategories: 'ai:reorderCategories',
  moveSession: 'ai:moveSession',
} as const

// 独立的事件 channel（流式订阅）
const aiEventChannels = {
  start: 'ai:start',
  chunk: 'ai:chunk',
  complete: 'ai:complete',
  halted: 'ai:halted',
  error: 'ai:error',
} as const

export function createAIConversationProxy() {
  const onStartFns = new Set<(messageId: string) => void>()
  const onChunkFns = new Set<(messageId: string, content: string, reasoning?: string) => void>()
  const onCompleteFns = new Set<(messageId: string) => void>()
  const onHaltedFns = new Set<(messageId: string, reason: string) => void>()
  const onErrorFns = new Set<(messageId: string, reason: string) => void>()

  function handleStart(_event: Electron.IpcRendererEvent, payload: { messageId: string }) {
    onStartFns.forEach(fn => fn(payload.messageId))
  }

  function handleChunk(_event: Electron.IpcRendererEvent, payload: { messageId: string; content?: string; reasoning?: string }) {
    onChunkFns.forEach(fn => fn(payload.messageId, payload.content || '', payload.reasoning))
  }

  function handleComplete(_event: Electron.IpcRendererEvent, payload: { messageId: string }) {
    onCompleteFns.forEach(fn => fn(payload.messageId))
  }

  function handleHalted(_event: Electron.IpcRendererEvent, payload: { messageId: string; reason?: string }) {
    onHaltedFns.forEach(fn => fn(payload.messageId, payload.reason || ''))
  }

  function handleError(_event: Electron.IpcRendererEvent, payload: { messageId: string; reason?: string }) {
    onErrorFns.forEach(fn => fn(payload.messageId, payload.reason || ''))
  }

  // 只注册一次 handler，之后通过 Set 调用所有 fn
  ipcRenderer.on(aiEventChannels.start, handleStart)
  ipcRenderer.on(aiEventChannels.chunk, handleChunk)
  ipcRenderer.on(aiEventChannels.complete, handleComplete)
  ipcRenderer.on(aiEventChannels.halted, handleHalted)
  ipcRenderer.on(aiEventChannels.error, handleError)

  const invokeProxy: Record<string, (...args: unknown[]) => unknown> = {}
  for (const [method, channel] of Object.entries(aiChannels)) {
    invokeProxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return {
    ...invokeProxy,
    onStart(fn: (messageId: string) => void) {
      onStartFns.add(fn)
      return () => { onStartFns.delete(fn) }
    },
    onChunk(fn: (messageId: string, content: string, reasoning?: string) => void) {
      onChunkFns.add(fn)
      return () => { onChunkFns.delete(fn) }
    },
    onComplete(fn: (messageId: string) => void) {
      onCompleteFns.add(fn)
      return () => { onCompleteFns.delete(fn) }
    },
    onHalted(fn: (messageId: string, reason: string) => void) {
      onHaltedFns.add(fn)
      return () => { onHaltedFns.delete(fn) }
    },
    onError(fn: (messageId: string, reason: string) => void) {
      onErrorFns.add(fn)
      return () => { onErrorFns.delete(fn) }
    },
  }
}

export type AIConversationModule = ReturnType<typeof createAIConversationProxy>
