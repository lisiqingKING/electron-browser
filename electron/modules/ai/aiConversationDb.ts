import { getDatabase } from '../../shared/database'

// ============ AI 会话 DAO 层 ============

export interface Message {
  msgId: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

export interface ChatSession {
  convId: string
  title: string
  createdAt: number
  updatedAt: number
  pinned: number
}

export type CreateChatSessionInput = Pick<ChatSession, 'title' | 'createdAt' | 'updatedAt'>

// 获取所有 AI 会话（置顶优先，再按更新时间倒序）
export function getAllChatSessions(): ChatSession[] {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, createdAt, updatedAt, pinned FROM ai_conversation ORDER BY pinned DESC, updatedAt DESC'
  )
  return stmt.all() as ChatSession[]
}

// 分页查询 AI 会话（置顶优先）
export function getChatSessionsPage(limit: number, offset: number): ChatSession[] {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, createdAt, updatedAt, pinned FROM ai_conversation ORDER BY pinned DESC, updatedAt DESC LIMIT ? OFFSET ?'
  )
  return stmt.all(limit, offset) as ChatSession[]
}

// 根据 convId 获取 AI 会话
export function getChatSessionByConvId(convId: string): ChatSession | undefined {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, createdAt, updatedAt, pinned FROM ai_conversation WHERE convId = ?'
  )
  return stmt.get(convId) as ChatSession | undefined
}

// 创建 AI 会话
export function createChatSession(convId: string, input: CreateChatSessionInput): void {
  const stmt = getDatabase().prepare(
    'INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned) VALUES (?, ?, ?, ?, 0)'
  )
  stmt.run(convId, input.title, input.createdAt, input.updatedAt)
}

// 更新置顶状态
export function updatePinned(convId: string, pinned: number): void {
  getDatabase().prepare(
    'UPDATE ai_conversation SET pinned = ?, updatedAt = ? WHERE convId = ?'
  ).run(pinned, Date.now(), convId)
}

// 更新标题
export function updateTitle(convId: string, title: string): void {
  getDatabase().prepare(
    'UPDATE ai_conversation SET title = ?, updatedAt = ? WHERE convId = ?'
  ).run(title, Date.now(), convId)
}

// 获取会话的所有消息（按时间升序）
export function getMessagesByConvId(convId: string): Message[] {
  const rows = getDatabase().prepare(
    'SELECT id AS msgId, role, content, created_at FROM messages WHERE convId = ? ORDER BY created_at ASC'
  ).all(convId) as { msgId: string; role: string; content: string; created_at: number }[]
  return rows.map(row => ({
    msgId: row.msgId,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    created_at: row.created_at,
  }))
}

// 追加消息
export function appendMessage(convId: string, msgId: string, role: 'user' | 'assistant', content: string, now: number): void {
  getDatabase().prepare(
    'INSERT INTO messages (id, convId, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(msgId, convId, role, content, now, now)
}

// 删除 AI 会话（messages 表通过外键级联删除）
export function deleteChatSessionByConvId(convId: string): void {
  getDatabase().prepare('DELETE FROM ai_conversation WHERE convId = ?').run(convId)
}
