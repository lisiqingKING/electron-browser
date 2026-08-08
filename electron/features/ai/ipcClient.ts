// aiConversation 模块 - 定义 IPC channel 和方法映射
export const aiConversationChannels = {
  list: 'ai:list',
  create: 'ai:create',
  updateTitle: 'ai:updateTitle',
  updateMessages: 'ai:updateMessages',
  delete: 'ai:delete',
  getModel: 'ai:getModel',
  updatePinned: 'ai:updatePinned',
  saveFile: 'ai:saveFile',
  openSaveDir: 'ai:openSaveDir',
  listSaveFiles: 'ai:listSaveFiles',
  readSaveFile: 'ai:readSaveFile',
  deleteSaveFile: 'ai:deleteSaveFile',
}

export interface Message {
  msgId: string
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  convId: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export function createAIConversationProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(aiConversationChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return proxy
}

export type AIConversationModule = ReturnType<typeof createAIConversationProxy>
