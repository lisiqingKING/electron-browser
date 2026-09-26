import * as aiConversationDb from '../aiConversationDb'
import type { ChatSession } from '../aiConversationDb'

export function getAllChatSessions(): ChatSession[] {
  return aiConversationDb.getAllChatSessions()
}

export function getChatSessionsPage(limit: number, offset: number): ChatSession[] {
  return aiConversationDb.getChatSessionsPage(limit, offset)
}

export function createChatSession(title: string = '新会话'): ChatSession {
  const now = Date.now()
  const convId = `${now}-${crypto.randomUUID().slice(0, 8)}`
  const input = { title, createdAt: now, updatedAt: now }
  aiConversationDb.createChatSession(convId, input)
  return { convId, ...input, pinned: 0 }
}

export function updateTitle(convId: string, title: string): void {
  aiConversationDb.updateTitle(convId, title)
}

export function deleteChatSession(convId: string): void {
  aiConversationDb.deleteChatSessionByConvId(convId)
}

export function updatePinned(convId: string, pinned: number): void {
  aiConversationDb.updatePinned(convId, pinned)
}
