import { getDatabase } from '../../shared/database'
import { PINNED_CATEGORY_ID } from '../../shared/constants'
import { clearActiveConvIfDeleted } from '../workspace/workspaceDb'
// 副作用导入：确保 ai_conversation / messages / messages_fts 表已创建
import './aiDb'

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
  /** 辅助会话所属工作区（主会话 convId），主会话为 null */
  scopeId: string | null
  /** 工作区内的 Tab 顺序 */
  ord: number
}

export type CreateChatSessionInput = Pick<
  ChatSession,
  'title' | 'createdAt' | 'updatedAt' | 'categoryId'
> &
  Partial<Pick<ChatSession, 'scopeId' | 'ord'>>

const SESSION_COLUMNS =
  'convId, title, createdAt, updatedAt, pinned, categoryId, scopeId, ord'

/**
 * 会话列表的排序：置顶优先，再按更新时间倒序。
 * 末尾必须带 convId 作为 tiebreaker —— updatedAt 相同（同一毫秒）时，
 * 没有 tiebreaker 的排序在两次查询之间可能给出不同顺序，
 * 同一份数据两次读出来顺序不一致。
 */
const SESSION_ORDER = 'ORDER BY pinned DESC, updatedAt DESC, convId DESC'

// 获取所有 AI 会话（置顶优先，再按更新时间倒序，排除辅助会话）
export function getAllChatSessions(): ChatSession[] {
  const stmt = getDatabase().prepare(
    `SELECT ${SESSION_COLUMNS} FROM ai_conversation WHERE isAssistant = 0 ${SESSION_ORDER}`
  )
  return stmt.all() as ChatSession[]
}

// 根据 convId 获取 AI 会话
export function getChatSessionByConvId(convId: string): ChatSession | undefined {
  const stmt = getDatabase().prepare(
    `SELECT ${SESSION_COLUMNS} FROM ai_conversation WHERE convId = ?`
  )
  return stmt.get(convId) as ChatSession | undefined
}

/** 会话归属信息：是否辅助会话、所属工作区 */
export interface ConversationOwnership {
  isAssistant: number
  scopeId: string | null
}

/**
 * 查询会话归属。IPC 边界用它判断「这个 convId 是不是辅助会话」，
 * 避免渲染进程传一个主会话 id 就把主会话删掉。
 */
export function getConversationOwnership(convId: string): ConversationOwnership | undefined {
  const stmt = getDatabase().prepare('SELECT isAssistant, scopeId FROM ai_conversation WHERE convId = ?')
  return stmt.get(convId) as ConversationOwnership | undefined
}

// 获取某工作区的辅助会话（isAssistant = 1 且 scopeId 匹配，按 Tab 顺序升序）
export function getAssistantChatSessions(scopeId: string): ChatSession[] {
  const stmt = getDatabase().prepare(
    `SELECT ${SESSION_COLUMNS} FROM ai_conversation WHERE isAssistant = 1 AND scopeId = ? ORDER BY ord ASC`
  )
  return stmt.all(scopeId) as ChatSession[]
}

// 工作区内下一个可用的 Tab 顺序
export function getNextAssistantOrd(scopeId: string): number {
  const row = getDatabase().prepare(
    'SELECT COALESCE(MAX(ord), -1) + 1 AS nextOrd FROM ai_conversation WHERE isAssistant = 1 AND scopeId = ?'
  ).get(scopeId) as { nextOrd: number }
  return row.nextOrd
}

// 创建 AI 会话
export function createChatSession(convId: string, input: CreateChatSessionInput, isAssistant: number = 0): void {
  const stmt = getDatabase().prepare(
    'INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant, scopeId, ord) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  stmt.run(
    convId,
    input.title,
    input.createdAt,
    input.updatedAt,
    // pinned 是 categoryId 的冗余副本，写入时就保持一致
    input.categoryId === PINNED_CATEGORY_ID ? 1 : 0,
    input.categoryId ?? null,
    isAssistant,
    input.scopeId ?? null,
    input.ord ?? 0
  )
}

// 更新 Tab 顺序
export function updateConversationOrd(convId: string, ord: number): void {
  getDatabase().prepare('UPDATE ai_conversation SET ord = ? WHERE convId = ?').run(ord, convId)
}

// 更新置顶状态（兼容旧接口）
// 置顶的唯一判据是 categoryId = PINNED_CATEGORY_ID，直接改 categoryId；
// 取消置顶回到默认分组 —— 原分组只在渲染进程内存里（previousCategoryId），主进程恢复不了。
export function updatePinned(convId: string, pinned: number): void {
  updateSessionCategory(convId, pinned ? PINNED_CATEGORY_ID : null)
}

// 更新标题
// 不动 updatedAt：改名是整理，不是"有新内容"。
// updatedAt 只由消息活动更新（touchConversation），它代表最后一条消息的时间。
export function updateTitle(convId: string, title: string): void {
  getDatabase().prepare(
    'UPDATE ai_conversation SET title = ? WHERE convId = ?'
  ).run(title, convId)
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

// 追加消息（同步写入全文索引）
export function appendMessage(convId: string, msgId: string, role: 'user' | 'assistant', content: string, now: number): void {
  const db = getDatabase()
  db.prepare(
    'INSERT INTO messages (id, convId, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(msgId, convId, role, content, now, now)
  db.prepare('INSERT INTO messages_fts (msgId, convId, content) VALUES (?, ?, ?)').run(
    msgId,
    convId,
    content
  )
}

// 删除单个会话的全部数据（消息 → 全文索引 → 会话记录）
// 手动按序删除，不依赖数据库外键自动级联
export function deleteConversationData(convId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM messages_fts WHERE msgId IN (SELECT id FROM messages WHERE convId = ?)').run(
    convId
  )
  db.prepare('DELETE FROM messages WHERE convId = ?').run(convId)
  db.prepare('DELETE FROM ai_conversation WHERE convId = ?').run(convId)
  clearActiveConvIfDeleted(convId)
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

// 目录下所有会话的 convId（删除目录时逐个走完整级联）
export function getSessionIdsByCategory(id: string): string[] {
  const rows = getDatabase()
    .prepare('SELECT convId FROM ai_conversation WHERE categoryId = ?')
    .all(id) as { convId: string }[]
  return rows.map((r) => r.convId)
}

// 删除目录（会话由调用方逐个删除）
export function deleteCategoryRow(id: string): void {
  getDatabase().prepare('DELETE FROM ai_categories WHERE id = ?').run(id)
}

// 更新目录顺序
export function updateCategoryOrder(id: string, ord: number): void {
  getDatabase().prepare('UPDATE ai_categories SET ord = ? WHERE id = ?').run(ord, id)
}

// 将会话移动到目录
// 不动 updatedAt：移动分组/置顶是整理，不是"有新内容"。
// updatedAt 只由消息活动更新（touchConversation），它代表最后一条消息的时间。
// 顺带的好处：整理操作不再改变排序键，分页列表的顺序也就不会被它打乱。
export function updateSessionCategory(convId: string, categoryId: string | null): void {
  getDatabase().prepare(
    'UPDATE ai_conversation SET categoryId = ?, pinned = ? WHERE convId = ?'
  ).run(categoryId, categoryId === PINNED_CATEGORY_ID ? 1 : 0, convId)
}
