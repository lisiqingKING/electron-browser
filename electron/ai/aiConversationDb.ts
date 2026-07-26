import { getDatabase } from '../database/index'

// ============ AI 会话 DAO 层 ============
// 数据访问层，负责数据库 CRUD 操作，不涉及业务逻辑和缓存

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
  pinned: number
}

export type CreateChatSessionInput = Pick<ChatSession, 'title' | 'messages' | 'createdAt' | 'updatedAt'>

// 获取所有 AI 会话（置顶优先，再按更新时间倒序）
export function getAllChatSessions(): ChatSession[] {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, messages, createdAt, updatedAt, pinned FROM ai_conversation ORDER BY pinned DESC, updatedAt DESC'
  )
  const rows = stmt.all() as { convId: string; title: string; messages: string; createdAt: number; updatedAt: number; pinned: number }[]
  return rows.map(row => ({
    convId: row.convId,
    title: row.title,
    messages: JSON.parse(row.messages),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    pinned: row.pinned
  }))
}

// 分页查询 AI 会话（置顶优先）
export function getChatSessionsPage(limit: number, offset: number): ChatSession[] {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, messages, createdAt, updatedAt, pinned FROM ai_conversation ORDER BY pinned DESC, updatedAt DESC LIMIT ? OFFSET ?'
  )
  const rows = stmt.all(limit, offset) as { convId: string; title: string; messages: string; createdAt: number; updatedAt: number; pinned: number }[]
  return rows.map(row => ({
    convId: row.convId,
    title: row.title,
    messages: JSON.parse(row.messages),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    pinned: row.pinned
  }))
}

// 根据 convId 获取 AI 会话
export function getChatSessionByConvId(convId: string): ChatSession | undefined {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, messages, createdAt, updatedAt, pinned FROM ai_conversation WHERE convId = ?'
  )
  const row = stmt.get(convId) as { convId: string; title: string; messages: string; createdAt: number; updatedAt: number; pinned: number } | undefined
  if (!row) return undefined
  return {
    convId: row.convId,
    title: row.title,
    messages: JSON.parse(row.messages),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    pinned: row.pinned
  }
}

// 创建 AI 会话
export function createChatSession(convId: string, input: CreateChatSessionInput): void {
  const stmt = getDatabase().prepare(
    'INSERT INTO ai_conversation (convId, title, messages, createdAt, updatedAt, pinned) VALUES (?, ?, ?, ?, ?, 0)'
  )
  stmt.run(convId, input.title, JSON.stringify(input.messages), input.createdAt, input.updatedAt)
}

// 更新置顶状态
export function updatePinned(convId: string, pinned: number): void {
  const stmt = getDatabase().prepare('UPDATE ai_conversation SET pinned = ?, updatedAt = ? WHERE convId = ?')
  stmt.run(pinned, Date.now(), convId)
}

// 更新标题
export function updateTitle(convId: string, title: string): void {
  const stmt = getDatabase().prepare('UPDATE ai_conversation SET title = ?, updatedAt = ? WHERE convId = ?')
  stmt.run(title, Date.now(), convId)
}

// 更新消息列表（全量）
export function updateMessages(convId: string, messages: Message[]): void {
  const stmt = getDatabase().prepare('UPDATE ai_conversation SET messages = ?, updatedAt = ? WHERE convId = ?')
  stmt.run(JSON.stringify(messages), Date.now(), convId)
}

// 删除 AI 会话
export function deleteChatSessionByConvId(convId: string): void {
  const stmt = getDatabase().prepare('DELETE FROM ai_conversation WHERE convId = ?')
  stmt.run(convId)
}
