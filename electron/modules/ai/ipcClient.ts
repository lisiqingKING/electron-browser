import { ipcRenderer } from 'electron'

// ai 模块 IPC channel 定义
export const aiChannels = {
  // 会话 CRUD
  list: 'ai:list',
  create: 'ai:create',
  updateTitle: 'ai:updateTitle',
  updateMessages: 'ai:updateMessages',
  delete: 'ai:delete',
  updatePinned: 'ai:updatePinned',
  // 模型/文件
  getModel: 'ai:getModel',
  getActiveProfile: 'ai:getActiveProfile',
  listProfiles: 'ai:listProfiles',
  saveProfile: 'ai:saveProfile',
  setActiveProfile: 'ai:setActiveProfile',
  deleteProfile: 'ai:deleteProfile',
  // System Prompt
  listSystemPrompts: 'ai:listSystemPrompts',
  saveSystemPrompt: 'ai:saveSystemPrompt',
  deleteSystemPrompt: 'ai:deleteSystemPrompt',
  getSystemPromptsByIds: 'ai:getSystemPromptsByIds',
  saveFile: 'ai:saveFile',
  openSaveDir: 'ai:openSaveDir',
  listSaveFiles: 'ai:listSaveFiles',
  readSaveFile: 'ai:readSaveFile',
  deleteSaveFile: 'ai:deleteSaveFile',
  // 流式聊天
  chat: 'ai:chat',
  abort: 'ai:abort',
}

// push channel，不在 invoke proxy 中暴露
const AI_STREAM_CHANNEL = 'ai:stream'

export type StreamCallback = (messageId: string, content?: string, reasoning?: string) => void

export function createAIConversationProxy(): Record<string, any> {
  // invoke 代理（渲染进程调用主进程）
  const invokeProxy: Record<string, Function> = {}
  for (const [method, channel] of Object.entries(aiChannels)) {
    invokeProxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  // push 订阅代理（封装 ai:stream，渲染进程不直接接触 channel 名）
  const onStartFns = new Set<(messageId: string) => void>()
  const onChunkFns = new Set<(messageId: string, content: string, reasoning?: string) => void>()
  const onCompleteFns = new Set<(messageId: string) => void>()
  const onHaltedFns = new Set<(messageId: string, reason: string) => void>()
  const onErrorFns = new Set<(messageId: string, reason: string) => void>()

  let listenerRegistered = false

  function handleStreamEvent(_event: Electron.IpcRendererEvent, payload: any) {
    const { messageId, type, content, reason, reasoning } = payload
    if (type === 'start') onStartFns.forEach(fn => fn(messageId))
    else if (type === 'chunk') onChunkFns.forEach(fn => fn(messageId, content || '', reasoning || ''))
    else if (type === 'complete') onCompleteFns.forEach(fn => fn(messageId))
    else if (type === 'halted') onHaltedFns.forEach(fn => fn(messageId, reason || ''))
    else if (type === 'error') onErrorFns.forEach(fn => fn(messageId, reason || ''))
  }

  function ensureListener() {
    if (!listenerRegistered) {
      ipcRenderer.on(AI_STREAM_CHANNEL, handleStreamEvent)
      listenerRegistered = true
    }
  }

  function cleanupIfEmpty() {
    if (!onStartFns.size && !onChunkFns.size && !onCompleteFns.size && !onHaltedFns.size && !onErrorFns.size) {
      ipcRenderer.removeListener(AI_STREAM_CHANNEL, handleStreamEvent)
      listenerRegistered = false
    }
  }

  return {
    ...invokeProxy,

    onStart(fn: (messageId: string) => void) { ensureListener(); onStartFns.add(fn) },
    onChunk(fn: (messageId: string, content: string, reasoning?: string) => void) { ensureListener(); onChunkFns.add(fn) },
    onComplete(fn: (messageId: string) => void) { ensureListener(); onCompleteFns.add(fn) },
    onHalted(fn: (messageId: string, reason: string) => void) { ensureListener(); onHaltedFns.add(fn) },
    onError(fn: (messageId: string, reason: string) => void) { ensureListener(); onErrorFns.add(fn) },

    offStart(fn: (messageId: string) => void) { onStartFns.delete(fn); cleanupIfEmpty() },
    offChunk(fn: (messageId: string, content: string, reasoning?: string) => void) { onChunkFns.delete(fn); cleanupIfEmpty() },
    offComplete(fn: (messageId: string) => void) { onCompleteFns.delete(fn); cleanupIfEmpty() },
    offHalted(fn: (messageId: string, reason: string) => void) { onHaltedFns.delete(fn); cleanupIfEmpty() },
    offError(fn: (messageId: string, reason: string) => void) { onErrorFns.delete(fn); cleanupIfEmpty() },
  }
}

export type AIConversationModule = ReturnType<typeof createAIConversationProxy>
