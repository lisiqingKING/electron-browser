import { getDatabase } from '../../shared/database'

// ============ 表初始化（兼容未执行迁移的旧数据库） ============
const db = getDatabase()
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL DEFAULT '新对话',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT    PRIMARY KEY,
    conversation_id TEXT    NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'sending',
    halt_reason     TEXT,
    model           TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS system_prompts (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    created_at  INTEGER NOT NULL
  )
`)

// ============ AI 聊天 DAO 层 ============
// 数据访问层，负责 conversations + messages 表的 CRUD 操作

export interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  status: 'sending' | 'streaming' | 'complete' | 'halted'
  halt_reason: 'user' | 'error' | 'network' | null
  model: string | null
  created_at: number
  updated_at: number
}

export interface ConversationRow {
  id: string
  title: string
  created_at: number
  updated_at: number
}

// ============ Conversation CRUD ============

export function createConversation(id: string, title: string, now: number): void {
  getDatabase().prepare(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, title, now, now)
}

export function getConversation(id: string): ConversationRow | undefined {
  return getDatabase().prepare(
    'SELECT * FROM conversations WHERE id = ?'
  ).get(id) as ConversationRow | undefined
}

export function getAllConversations(): ConversationRow[] {
  return getDatabase().prepare(
    'SELECT * FROM conversations ORDER BY updated_at DESC'
  ).all() as ConversationRow[]
}

export function touchConversation(id: string, now: number): void {
  // INSERT OR IGNORE：conversation 不存在时先创建
  getDatabase().prepare(
    'INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, '新对话', now, now)
  // 再更新
  getDatabase().prepare(
    'UPDATE conversations SET updated_at = ? WHERE id = ?'
  ).run(now, id)
}

export function updateConversationTitle(id: string, title: string, now: number): void {
  getDatabase().prepare(
    'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?'
  ).run(title, now, id)
}

export function deleteConversation(id: string): void {
  getDatabase().prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

// ============ Message CRUD ============

export function createMessage(msg: MessageRow): void {
  getDatabase().prepare(`
    INSERT INTO messages (id, conversation_id, role, content, status, halt_reason, model, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    msg.id, msg.conversation_id, msg.role, msg.content, msg.status,
    msg.halt_reason, msg.model, msg.created_at, msg.updated_at
  )
}

export function getMessage(id: string): MessageRow | undefined {
  return getDatabase().prepare(
    'SELECT * FROM messages WHERE id = ?'
  ).get(id) as MessageRow | undefined
}

export function getMessagesByConversation(conversationId: string): MessageRow[] {
  return getDatabase().prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(conversationId) as MessageRow[]
}

export function updateMessageContent(id: string, content: string, now: number): void {
  getDatabase().prepare(
    'UPDATE messages SET content = ?, updated_at = ? WHERE id = ?'
  ).run(content, now, id)
}

export function updateMessageStatus(
  id: string,
  status: 'sending' | 'streaming' | 'complete' | 'halted',
  halt_reason: 'user' | 'error' | 'network' | null,
  now: number
): void {
  getDatabase().prepare(
    'UPDATE messages SET status = ?, halt_reason = ?, updated_at = ? WHERE id = ?'
  ).run(status, halt_reason, now, id)
}

// ============ System Prompt CRUD ============

export interface SystemPromptRow {
  id: string
  name: string
  content: string
  created_at: number
}

export function createSystemPrompt(id: string, name: string, content: string, now: number): void {
  getDatabase().prepare(
    'INSERT INTO system_prompts (id, name, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, name, content, now)
}

export function getSystemPrompt(id: string): SystemPromptRow | undefined {
  return getDatabase().prepare(
    'SELECT * FROM system_prompts WHERE id = ?'
  ).get(id) as SystemPromptRow | undefined
}

export function getAllSystemPrompts(): SystemPromptRow[] {
  return getDatabase().prepare(
    'SELECT * FROM system_prompts ORDER BY created_at ASC'
  ).all() as SystemPromptRow[]
}

export function updateSystemPrompt(id: string, name: string, content: string): void {
  getDatabase().prepare(
    'UPDATE system_prompts SET name = ?, content = ? WHERE id = ?'
  ).run(name, content, id)
}

export function deleteSystemPrompt(id: string): void {
  getDatabase().prepare('DELETE FROM system_prompts WHERE id = ?').run(id)
}
