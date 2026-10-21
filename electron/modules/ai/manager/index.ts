import * as aiConversationDb from '../aiConversationDb'
import { getDatabase } from '../../../shared/database'
import { deleteWorkspaceByScope } from '../../workspace/workspaceDb'
import type { ChatSession, Category } from '../aiConversationDb'

export function getAllChatSessions(): ChatSession[] {
  return aiConversationDb.getAllChatSessions()
}

export function getAssistantChatSessions(scopeId: string): ChatSession[] {
  return aiConversationDb.getAssistantChatSessions(scopeId)
}

export function getChatSessionsPage(limit: number, offset: number): ChatSession[] {
  return aiConversationDb.getChatSessionsPage(limit, offset)
}

export function createChatSession(title: string = '新会话', categoryId: string | null = null, isAssistant: number = 0): ChatSession {
  const now = Date.now()
  const convId = `${now}-${crypto.randomUUID().slice(0, 8)}`
  const input = {
    title,
    createdAt: now,
    updatedAt: now,
    categoryId,
    scopeId: null,
    ord: 0,
  }
  aiConversationDb.createChatSession(convId, input, isAssistant)
  return { convId, ...input, pinned: 0 }
}

// 在指定工作区新建辅助会话
export function createAssistantChatSession(scopeId: string, title: string = '新会话'): ChatSession {
  const now = Date.now()
  const convId = `${now}-${crypto.randomUUID().slice(0, 8)}`
  const input = {
    title,
    createdAt: now,
    updatedAt: now,
    categoryId: null,
    scopeId,
    ord: aiConversationDb.getNextAssistantOrd(scopeId),
  }
  aiConversationDb.createChatSession(convId, input, 1)
  return { convId, ...input, pinned: 0 }
}

export function updateTitle(convId: string, title: string): void {
  aiConversationDb.updateTitle(convId, title)
}

/**
 * 删除会话的级联逻辑（辅助会话 → 笔记与工作区状态 → 主会话本身）。
 * 不自带事务：批量删除时由外层统一开事务，避免事务嵌套。
 */
function cascadeDeleteChatSession(convId: string): void {
  const assistants = aiConversationDb.getAssistantChatSessions(convId)
  for (const assistant of assistants) {
    aiConversationDb.deleteConversationData(assistant.convId)
  }
  deleteWorkspaceByScope(convId)
  aiConversationDb.deleteConversationData(convId)
}

// 删除会话：主会话级联清理整个工作区，辅助会话只清自己的消息
export function deleteChatSession(convId: string): void {
  const db = getDatabase()
  const tx = db.transaction(() => cascadeDeleteChatSession(convId))
  tx()
}

// 删除辅助会话：只清自己的消息与会话记录。
// 笔记归工作区（主会话）所有，不随辅助会话删除 —— 快照字段保证来源消失后仍可读。
export function deleteAssistantChatSession(convId: string): void {
  aiConversationDb.deleteConversationData(convId)
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

/**
 * 删除目录及目录下所有会话。
 * 每个会话都走 deleteChatSession —— 主会话的工作区（辅助会话 / 笔记 / 状态）
 * 一并清掉，不留孤儿数据。
 */
export function deleteCategoryAndSessions(id: string): void {
  const convIds = aiConversationDb.getSessionIdsByCategory(id)
  const db = getDatabase()
  const tx = db.transaction(() => {
    for (const convId of convIds) {
      cascadeDeleteChatSession(convId)
    }
    aiConversationDb.deleteCategoryRow(id)
  })
  tx()
}

export function reorderCategories(orderedIds: string[]): void {
  if (!orderedIds || orderedIds.length === 0) return
  const db = getDatabase()
  const update = db.transaction((id: string, index: number) => {
    aiConversationDb.updateCategoryOrder(id, index)
  })
  orderedIds.forEach((id, index) => update(id, index))
}

export function moveSession(convId: string, categoryId: string | null): void {
  aiConversationDb.updateSessionCategory(convId, categoryId)
}
