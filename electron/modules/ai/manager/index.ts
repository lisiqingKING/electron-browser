import * as aiConversationDb from '../aiConversationDb'
import type { ChatSession, Category } from '../aiConversationDb'

export function getAllChatSessions(): ChatSession[] {
  return aiConversationDb.getAllChatSessions()
}

export function getChatSessionsPage(limit: number, offset: number): ChatSession[] {
  return aiConversationDb.getChatSessionsPage(limit, offset)
}

export function createChatSession(title: string = '新会话', categoryId: string | null = null, isAssistant: number = 0): ChatSession {
  const now = Date.now()
  const convId = `${now}-${crypto.randomUUID().slice(0, 8)}`
  const input = { title, createdAt: now, updatedAt: now, categoryId }
  aiConversationDb.createChatSession(convId, input, isAssistant)
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

// ============ Category（目录）CRUD ============

export function getAllCategories(): Category[] {
  return aiConversationDb.getAllCategories()
}

export function createCategory(name: string): Category {
  const existing = aiConversationDb.getAllCategories().find(c => c.name === name)
  if (existing) return existing
  const now = Date.now()
  const id = `cat-${now}-${crypto.randomUUID().slice(0, 8)}`
  const ord = now
  aiConversationDb.createCategory(id, name, ord)
  return { id, name, ord }
}

export function renameCategory(id: string, name: string): void {
  aiConversationDb.renameCategory(id, name)
}

export function deleteCategory(id: string): void {
  aiConversationDb.deleteCategory(id)
}

export function deleteCategoryAndSessions(id: string): void {
  aiConversationDb.deleteCategoryAndSessions(id)
}

export function moveSession(convId: string, categoryId: string | null): void {
  aiConversationDb.updateSessionCategory(convId, categoryId)
}
