import { getDatabase } from '../../shared/database'

// ============ AI 会话 DAO 层 ============

export interface Message {
  msgId: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

export interface Category {
  id: string
  name: string
  ord: number
}

export interface ChatSession {
  convId: string
  title: string
  createdAt: number
  updatedAt: number
  pinned: number
  categoryId: string | null
}

export type CreateChatSessionInput = Pick<ChatSession, 'title' | 'createdAt' | 'updatedAt' | 'categoryId'>

// 获取所有 AI 会话（置顶优先，再按更新时间倒序，排除辅助会话）
export function getAllChatSessions(): ChatSession[] {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, createdAt, updatedAt, pinned, categoryId FROM ai_conversation WHERE isAssistant = 0 ORDER BY pinned DESC, updatedAt DESC'
  )
  return stmt.all() as ChatSession[]
}

// 分页查询 AI 会话（置顶优先，排除辅助会话）
export function getChatSessionsPage(limit: number, offset: number): ChatSession[] {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, createdAt, updatedAt, pinned, categoryId FROM ai_conversation WHERE isAssistant = 0 ORDER BY pinned DESC, updatedAt DESC LIMIT ? OFFSET ?'
  )
  return stmt.all(limit, offset) as ChatSession[]
}

// 根据 convId 获取 AI 会话
export function getChatSessionByConvId(convId: string): ChatSession | undefined {
  const stmt = getDatabase().prepare(
    'SELECT convId, title, createdAt, updatedAt, pinned, categoryId FROM ai_conversation WHERE convId = ?'
  )
  return stmt.get(convId) as ChatSession | undefined
}

// 创建 AI 会话
export function createChatSession(convId: string, input: CreateChatSessionInput, isAssistant: number = 0): void {
  const stmt = getDatabase().prepare(
    'INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant) VALUES (?, ?, ?, ?, 0, ?, ?)'
  )
  stmt.run(convId, input.title, input.createdAt, input.updatedAt, input.categoryId ?? null, isAssistant)
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

// ============ Category（目录）CRUD ============

// 获取所有目录
export function getAllCategories(): Category[] {
  return getDatabase().prepare(
    'SELECT id, name, ord FROM ai_categories ORDER BY ord ASC'
  ).all() as Category[]
}

// 创建目录
export function createCategory(id: string, name: string, ord: number): void {
  getDatabase().prepare(
    'INSERT INTO ai_categories (id, name, ord) VALUES (?, ?, ?)'
  ).run(id, name, ord)
}

// 重命名目录
export function renameCategory(id: string, name: string): void {
  getDatabase().prepare(
    'UPDATE ai_categories SET name = ? WHERE id = ?'
  ).run(name, id)
}

// 删除目录（仅删除目录，会话迁移到默认分组）
export function deleteCategory(id: string): void {
  getDatabase().prepare(
    'UPDATE ai_conversation SET categoryId = NULL WHERE categoryId = ?'
  ).run(id)
  getDatabase().prepare('DELETE FROM ai_categories WHERE id = ?').run(id)
}

// 删除目录及目录下所有会话（依赖外键级联删除 messages）
export function deleteCategoryAndSessions(id: string): void {
  getDatabase().prepare('DELETE FROM ai_conversation WHERE categoryId = ?').run(id)
  getDatabase().prepare('DELETE FROM ai_categories WHERE id = ?').run(id)
}

// 更新目录顺序
export function updateCategoryOrder(id: string, ord: number): void {
  getDatabase().prepare('UPDATE ai_categories SET ord = ? WHERE id = ?').run(ord, id)
}

// 将会话移动到目录
export function updateSessionCategory(convId: string, categoryId: string | null): void {
  getDatabase().prepare(
    'UPDATE ai_conversation SET categoryId = ?, updatedAt = ? WHERE convId = ?'
  ).run(categoryId, Date.now(), convId)
}
