// ai 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'

export const aiChannels = {
  list: 'ai:list',
  create: 'ai:create',
  updateTitle: 'ai:updateTitle',
  updateMessages: 'ai:updateMessages',
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
  stream: 'ai:stream',
} as const

export function createAIConversationProxy() {
  const onStartFns = new Set<(messageId: string) => void>()
  const onChunkFns = new Set<(messageId: string, content: string, reasoning?: string) => void>()
  const onCompleteFns = new Set<(messageId: string) => void>()
  const onHaltedFns = new Set<(messageId: string, reason: string) => void>()
  const onErrorFns = new Set<(messageId: string, reason: string) => void>()
  let listenerRegistered = false

  function handleStreamEvent(_event: Electron.IpcRendererEvent, payload: unknown) {
    const { messageId, type, content, reason, reasoning } = payload as {
      messageId: string
      type: string
      content?: string
      reason?: string
      reasoning?: string
    }
    if (type === 'start') onStartFns.forEach(fn => fn(messageId))
    else if (type === 'chunk') onChunkFns.forEach(fn => fn(messageId, content || '', reasoning || ''))
    else if (type === 'complete') onCompleteFns.forEach(fn => fn(messageId))
    else if (type === 'halted') onHaltedFns.forEach(fn => fn(messageId, reason || ''))
    else if (type === 'error') onErrorFns.forEach(fn => fn(messageId, reason || ''))
  }

  function ensureListener() {
    if (!listenerRegistered) {
      ipcRenderer.on(aiChannels.stream, handleStreamEvent)
      listenerRegistered = true
    }
  }

  function cleanupIfEmpty() {
    if (!onStartFns.size && !onChunkFns.size && !onCompleteFns.size && !onHaltedFns.size && !onErrorFns.size) {
      ipcRenderer.removeListener(aiChannels.stream, handleStreamEvent)
      listenerRegistered = false
    }
  }

  const invokeProxy: Record<string, (...args: unknown[]) => unknown> = {}
  for (const [method, channel] of Object.entries(aiChannels)) {
    invokeProxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return {
    ...invokeProxy,
    onStart(fn: (messageId: string) => void) {
      ensureListener()
      onStartFns.add(fn)
      return () => { onStartFns.delete(fn); cleanupIfEmpty() }
    },
    onChunk(fn: (messageId: string, content: string, reasoning?: string) => void) {
      ensureListener()
      onChunkFns.add(fn)
      return () => { onChunkFns.delete(fn); cleanupIfEmpty() }
    },
    onComplete(fn: (messageId: string) => void) {
      ensureListener()
      onCompleteFns.add(fn)
      return () => { onCompleteFns.delete(fn); cleanupIfEmpty() }
    },
    onHalted(fn: (messageId: string, reason: string) => void) {
      ensureListener()
      onHaltedFns.add(fn)
      return () => { onHaltedFns.delete(fn); cleanupIfEmpty() }
    },
    onError(fn: (messageId: string, reason: string) => void) {
      ensureListener()
      onErrorFns.add(fn)
      return () => { onErrorFns.delete(fn); cleanupIfEmpty() }
    },
  }
}

export type AIConversationModule = ReturnType<typeof createAIConversationProxy>
