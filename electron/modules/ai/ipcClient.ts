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
export const AI_STREAM_CHANNEL = 'ai:stream'

export interface AIStreamPayload {
  messageId: string
  type: 'start' | 'chunk' | 'complete' | 'halted' | 'error'
  content?: string
  reason?: 'user' | 'error' | 'network'
}

export type StreamCallback = (payload: AIStreamPayload) => void

export function createAIConversationProxy(): Record<string, any> {
  // invoke 代理（渲染进程调用主进程）
  const invokeProxy: Record<string, Function> = {}
  for (const [method, channel] of Object.entries(aiChannels)) {
    invokeProxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  // push 订阅代理（封装 ai:stream，渲染进程不直接接触 channel 名）
  const streamListeners = new Set<StreamCallback>()

  function handleStreamEvent(_event: Electron.IpcRendererEvent, payload: AIStreamPayload) {
    for (const cb of streamListeners) {
      cb(payload)
    }
  }

  return {
    ...invokeProxy,

    // 订阅流式事件（渲染进程调用，无须知道 ai:stream channel 名）
    onStream(cb: StreamCallback) {
      if (streamListeners.size === 0) {
        ipcRenderer.on(AI_STREAM_CHANNEL, handleStreamEvent)
      }
      streamListeners.add(cb)
    },

    // 取消订阅
    offStream(cb: StreamCallback) {
      streamListeners.delete(cb)
      if (streamListeners.size === 0) {
        ipcRenderer.removeListener(AI_STREAM_CHANNEL, handleStreamEvent)
      }
    },
  }
}

export type AIConversationModule = ReturnType<typeof createAIConversationProxy>
