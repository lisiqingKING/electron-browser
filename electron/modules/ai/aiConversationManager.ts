import * as aiConversationDb from './aiConversationDb'
import type { ChatSession, Message } from './aiConversationDb'

// ============ AI 会话 Manager 层 ============
// 增删改查操作，调用 DAO 层

// 查询所有 AI 会话
export function getAllChatSessions(): ChatSession[] {
  return aiConversationDb.getAllChatSessions()
}

// 分页查询 AI 会话
export function getChatSessionsPage(limit: number, offset: number): ChatSession[] {
  return aiConversationDb.getChatSessionsPage(limit, offset)
}

// 新增 AI 会话
export function createChatSession(title: string = '新会话'): ChatSession {
  const now = Date.now()
  const convId = `${now}-${crypto.randomUUID().slice(0, 8)}`
  const messages: Message[] = []
  const input = { title, messages, createdAt: now, updatedAt: now }
  aiConversationDb.createChatSession(convId, input)
  return { convId, ...input, pinned: 0 }
}

// 更新标题
export function updateTitle(convId: string, title: string): void {
  aiConversationDb.updateTitle(convId, title)
}

// 更新消息列表（全量）
export function updateMessages(convId: string, messages: Message[]): void {
  aiConversationDb.updateMessages(convId, messages)
}

// 删除 AI 会话
export function deleteChatSession(convId: string): void {
  aiConversationDb.deleteChatSessionByConvId(convId)
}

// 更新置顶状态
export function updatePinned(convId: string, pinned: number): void {
  aiConversationDb.updatePinned(convId, pinned)
}
