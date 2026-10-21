import { getDatabase } from '../../shared/database'

// ============ 表初始化 ============
// 归属：notes（笔记）由本模块拥有。笔记属于某个工作区（主会话），
// 不属于产生它的辅助会话 —— 辅助会话被删除后笔记仍保留，靠快照字段保证可读。

const db = getDatabase()

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id               TEXT    PRIMARY KEY,
    scopeId          TEXT    NOT NULL,
    title            TEXT    NOT NULL DEFAULT '新笔记',
    content          TEXT    NOT NULL DEFAULT '',
    ord              INTEGER NOT NULL DEFAULT 0,
    sourceType       TEXT,
    sourceConvId     TEXT,
    sourceMsgId      TEXT,
    sourceConvTitle  TEXT,
    sourceMsgContent TEXT,
    createdAt        INTEGER NOT NULL,
    updatedAt        INTEGER NOT NULL
  )
`)

db.exec('CREATE INDEX IF NOT EXISTS idx_notes_scope ON notes(scopeId)')
db.exec('CREATE INDEX IF NOT EXISTS idx_notes_sourceConv ON notes(sourceConvId)')

// 全文索引：trigram 分词器（unicode61 对中文完全失效），索引由本模块显式同步
const notesFts = db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = 'notes_fts'")
  .get() as { sql?: string } | undefined
if (notesFts?.sql && !notesFts.sql.includes('trigram')) {
  db.exec('DROP TABLE notes_fts')
}
db.exec(
  "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(noteId UNINDEXED, content, tokenize='trigram')"
)

// ============ 类型 ============

export interface Note {
  id: string
  scopeId: string
  title: string
  content: string
  ord: number
  sourceType: string | null
  sourceConvId: string | null
  sourceMsgId: string | null
  sourceConvTitle: string | null
  sourceMsgContent: string | null
  createdAt: number
  updatedAt: number
}

export interface CreateNoteInput {
  scopeId: string
  title?: string
  content?: string
  sourceType?: string | null
  sourceConvId?: string | null
  sourceMsgId?: string | null
  sourceConvTitle?: string | null
  sourceMsgContent?: string | null
}

/** 笔记内容上限 1MB */
const MAX_CONTENT_BYTES = 1024 * 1024

function assertContentSize(content: string): void {
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
    throw new Error(`笔记内容超过上限 ${MAX_CONTENT_BYTES} 字节`)
  }
}

// ============ CRUD ============

// 创建笔记
export function createNote(input: CreateNoteInput): Note {
  const now = Date.now()
  const id = `note-${now}-${crypto.randomUUID().slice(0, 8)}`
  const title = input.title ?? '新笔记'
  const content = input.content ?? ''
  assertContentSize(content)

  const ord = (
    getDatabase()
      .prepare('SELECT COALESCE(MAX(ord), -1) + 1 AS nextOrd FROM notes WHERE scopeId = ?')
      .get(input.scopeId) as { nextOrd: number }
  ).nextOrd

  getDatabase()
    .prepare(
      `INSERT INTO notes (id, scopeId, title, content, ord, sourceType, sourceConvId, sourceMsgId, sourceConvTitle, sourceMsgContent, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.scopeId,
      title,
      content,
      ord,
      input.sourceType ?? null,
      input.sourceConvId ?? null,
      input.sourceMsgId ?? null,
      input.sourceConvTitle ?? null,
      input.sourceMsgContent ?? null,
      now,
      now
    )
  getDatabase().prepare('INSERT INTO notes_fts (noteId, content) VALUES (?, ?)').run(id, content)

  return getNote(id)!
}

// 获取笔记
export function getNote(id: string): Note | null {
  const row = getDatabase().prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
  return row ?? null
}

// 获取某工作区的笔记（按列表顺序）
export function getNotesByScope(scopeId: string): Note[] {
  return getDatabase()
    .prepare('SELECT * FROM notes WHERE scopeId = ? ORDER BY ord ASC, createdAt ASC')
    .all(scopeId) as Note[]
}

// 更新笔记（内容变更时同步全文索引）
export function updateNote(id: string, patch: { title?: string; content?: string }): Note {
  const existing = getNote(id)
  if (!existing) throw new Error('笔记不存在')

  const title = patch.title ?? existing.title
  const content = patch.content ?? existing.content
  assertContentSize(content)

  getDatabase()
    .prepare('UPDATE notes SET title = ?, content = ?, updatedAt = ? WHERE id = ?')
    .run(title, content, Date.now(), id)

  if (patch.content !== undefined) {
    getDatabase().prepare('DELETE FROM notes_fts WHERE noteId = ?').run(id)
    getDatabase().prepare('INSERT INTO notes_fts (noteId, content) VALUES (?, ?)').run(id, content)
  }

  return getNote(id)!
}

// 删除笔记（含全文索引）
export function deleteNote(id: string): void {
  getDatabase().prepare('DELETE FROM notes_fts WHERE noteId = ?').run(id)
  getDatabase().prepare('DELETE FROM notes WHERE id = ?').run(id)
}

// 更新笔记在列表中的顺序
export function updateNoteOrd(id: string, ord: number): void {
  getDatabase().prepare('UPDATE notes SET ord = ? WHERE id = ?').run(ord, id)
}

// 删除某工作区的全部笔记（含全文索引）
export function deleteNotesByScope(scopeId: string): void {
  const db2 = getDatabase()
  db2.prepare('DELETE FROM notes_fts WHERE noteId IN (SELECT id FROM notes WHERE scopeId = ?)').run(
    scopeId
  )
  db2.prepare('DELETE FROM notes WHERE scopeId = ?').run(scopeId)
}
