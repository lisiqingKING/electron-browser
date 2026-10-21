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

// 迁移：scopeId = 辅助会话所属工作区（主会话 convId）
try {
  db.exec('ALTER TABLE ai_conversation ADD COLUMN scopeId TEXT')
} catch (e) {
  const msg = String(e)
  if (!msg.includes('duplicate column')) {
    ipcLogger.error('[aiDb] scopeId migration failed:', e)
    throw e
  }
}

// 迁移：ord = 工作区内的 Tab 顺序
try {
  db.exec('ALTER TABLE ai_conversation ADD COLUMN ord INTEGER NOT NULL DEFAULT 0')
} catch (e) {
  const msg = String(e)
  if (!msg.includes('duplicate column')) {
    ipcLogger.error('[aiDb] ord migration failed:', e)
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

// 消息全文索引：trigram 分词器，unicode61 对中文完全失效
// 分词器不可 ALTER，结构不匹配时重建（该表为辅助面板功能新增，未发布过）
const messagesFts = db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = 'messages_fts'")
  .get() as { sql?: string } | undefined
if (messagesFts?.sql && !messagesFts.sql.includes('trigram')) {
  db.exec('DROP TABLE messages_fts')
}
db.exec(
  "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(msgId UNINDEXED, convId UNINDEXED, content, tokenize='trigram')"
)

// 回填：功能上线前产生的历史消息不在索引里，补一次让旧会话也能被搜到
db.exec(
  `INSERT INTO messages_fts (msgId, convId, content)
   SELECT id, convId, content FROM messages
   WHERE id NOT IN (SELECT msgId FROM messages_fts)`
)

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

/**
 * 确保会话行存在（幂等），返回是否新建。
 *
 * 渲染进程新建的对话在发出首条消息之前只存在于内存（local- 前缀 id），
 * 主进程没有对应行。辅助面板以主会话为工作区，必须先把行落库，
 * 否则工作区查不到、笔记无处归属。
 * 已有行不动 updatedAt，避免会话在侧边栏里被顶到最前。
 */
export function ensureConversation(convId: string, now: number): boolean {
  const db = getDatabase()
  const row = db.prepare('SELECT convId FROM ai_conversation WHERE convId = ?').get(convId)
  if (row) return false
  db.prepare(
    'INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, isAssistant) VALUES (?, ?, ?, ?, 0, 0)'
  ).run(convId, '新对话', now, now)
  return true
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
