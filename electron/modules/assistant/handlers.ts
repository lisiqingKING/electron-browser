import { ipcMain } from 'electron'
import { createAssistantWindow, closeAssistantWindow } from './manager'
import * as convDb from './conversationDb'

export function registerAssistantHandlers(): void {
  ipcMain.handle('assistant:createSession', (_event, opts: {
    title?: string
    sourceType?: string
    sourceId?: string
  }) => {
    const now = Date.now()
    const convId = `${now}-${crypto.randomUUID().slice(0, 8)}`
    convDb.createAssistantConv(convId, opts.title || 'AI 辅助', opts.sourceType || null, opts.sourceId || null, now)
    if (opts.sourceType && opts.sourceId) {
      convDb.createLink(opts.sourceType, opts.sourceId, convId, now)
    }
    return { convId }
  })

  ipcMain.handle('assistant:create', (event, opts: { x: number; y: number; convId?: string }) => {
    const win = createAssistantWindow(opts.x, opts.y, opts.convId, event.sender)
    return { windowId: win.id }
  })

  ipcMain.on('assistant:close', (_event, windowId: number) => {
    closeAssistantWindow(windowId)
  })

  ipcMain.handle('assistant:getSession', (_event, convId: string) => {
    return convDb.getAssistantConv(convId)
  })

  ipcMain.handle('assistant:updateTitle', (_event, convId: string, title: string) => {
    convDb.updateAssistantTitle(convId, title, Date.now())
    return true
  })

  ipcMain.handle('assistant:getMessages', (_event, convId: string) => {
    return convDb.getAssistantMessages(convId)
  })

  ipcMain.handle('assistant:addMessage', (_event, opts: { convId: string; role: 'user' | 'assistant'; content: string }) => {
    const now = Date.now()
    const id = `msg-${now}-${crypto.randomUUID().slice(0, 8)}`
    convDb.addAssistantMessage(id, opts.convId, opts.role, opts.content, now)
    return { id }
  })

  ipcMain.handle('assistant:getLinksForSource', (_event, sourceType: string, sourceId: string) => {
    return convDb.getLinkForSource(sourceType, sourceId)
  })

  ipcMain.handle('assistant:deleteSession', (_event, convId: string) => {
    convDb.deleteAssistantConv(convId)
    return true
  })

  ipcMain.handle('assistant:openWithSource', (event, opts: { x: number; y: number; sourceType: string; sourceId: string }) => {
    const now = Date.now()
    let convId = convDb.getConvIdForSource(opts.sourceType, opts.sourceId)
    if (!convId) {
      convId = `${now}-${crypto.randomUUID().slice(0, 8)}`
      convDb.createAssistantConv(convId, 'AI 辅助', opts.sourceType, opts.sourceId, now)
      convDb.createLink(opts.sourceType, opts.sourceId, convId, now)
    }
    const win = createAssistantWindow(opts.x, opts.y, convId, event.sender)
    return { windowId: win.id, convId }
  })
}
