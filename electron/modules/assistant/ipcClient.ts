import { ipcRenderer } from 'electron'

export const assistantChannels = {
  create: 'assistant:create',
  close: 'assistant:close',
} as const

export interface CreateAssistantOptions {
  x: number
  y: number
  convId?: string
}

export interface CreateSessionOptions {
  title?: string
  sourceType?: string
  sourceId?: string
}

export function createAssistantProxy() {
  return {
    create: (options: CreateAssistantOptions): Promise<{ windowId: number }> => {
      return ipcRenderer.invoke(assistantChannels.create, options)
    },
    close: (windowId: number): void => {
      ipcRenderer.send(assistantChannels.close, windowId)
    },
    createSession: (options: CreateSessionOptions): Promise<{ convId: string }> => {
      return ipcRenderer.invoke('assistant:createSession', options)
    },
    getSession: (convId: string) => {
      return ipcRenderer.invoke('assistant:getSession', convId)
    },
    updateTitle: (convId: string, title: string) => {
      return ipcRenderer.invoke('assistant:updateTitle', convId, title)
    },
    getMessages: (convId: string) => {
      return ipcRenderer.invoke('assistant:getMessages', convId)
    },
    addMessage: (opts: { convId: string; role: 'user' | 'assistant'; content: string }) => {
      return ipcRenderer.invoke('assistant:addMessage', opts)
    },
    getLinksForSource: (sourceType: string, sourceId: string) => {
      return ipcRenderer.invoke('assistant:getLinksForSource', sourceType, sourceId)
    },
    deleteSession: (convId: string) => {
      return ipcRenderer.invoke('assistant:deleteSession', convId)
    },
    openWithSource: (opts: { x: number; y: number; sourceType: string; sourceId: string }) => {
      return ipcRenderer.invoke('assistant:openWithSource', opts)
    },
  }
}

export type AssistantModule = ReturnType<typeof createAssistantProxy>
