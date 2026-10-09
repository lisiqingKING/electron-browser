import { getDatabase } from '../../shared/database'
import { ipcLogger } from '../../shared/logger'

// ============ 表初始化 ============
const db = getDatabase()
db.exec(`
  CREATE TABLE IF NOT EXISTS system_prompts (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    created_at  INTEGER NOT NULL
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_conversation (
    convId      TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL DEFAULT '新会话',
    createdAt   INTEGER NOT NULL,
    updatedAt   INTEGER NOT NULL,
    pinned      INTEGER NOT NULL DEFAULT 0,
    categoryId  TEXT,
    isAssistant INTEGER NOT NULL DEFAULT 0
  )
`)

// 迁移：旧表加 isAssistant 列
try {
  db.exec('ALTER TABLE ai_conversation ADD COLUMN isAssistant INTEGER NOT NULL DEFAULT 0')
} catch (e) {
  const msg = String(e)
  if (msg.includes('duplicate column') || msg.includes('no such column')) {
    // 列已存在或已迁移，忽略
  } else {
    ipcLogger.error('[aiDb] migration failed:', e)
    throw e
  }
}
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT    PRIMARY KEY,
    convId          TEXT    NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (convId) REFERENCES ai_conversation(convId) ON DELETE CASCADE
  )
`)
db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(convId)')
db.exec('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)')

// AI 目录表
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_categories (
    id    TEXT    PRIMARY KEY,
    name  TEXT    NOT NULL,
    ord   INTEGER NOT NULL DEFAULT 0
  )
`)

// 迁移：name 唯一约束
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON ai_categories(name)')
} catch (e) {
  const msg = String(e)
  if (!msg.includes('already exists') && !msg.includes('duplicate')) {
    ipcLogger.error('[aiDb] category unique index migration failed:', e)
    throw e
  }
}

// ============ AI 会话（touch） ============

export function touchConversation(convId: string, now: number): void {
  getDatabase().prepare(
    'INSERT OR IGNORE INTO ai_conversation (convId, title, createdAt, updatedAt, pinned) VALUES (?, ?, ?, ?, 0)'
  ).run(convId, '新对话', now, now)
  getDatabase().prepare(
    'UPDATE ai_conversation SET updatedAt = ? WHERE convId = ?'
  ).run(now, convId)
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
