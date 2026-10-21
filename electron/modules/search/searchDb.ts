import { getDatabase } from '../../shared/database'

// ============ 全文搜索 ============
// 范围：全部工作区（跨主会话）。类型：笔记正文 + 对话消息正文。
//
// 索引用 trigram 分词器（unicode61 对中文完全失效）。trigram 只能匹配 3 字符
// 及以上的查询，1-2 字符的短关键词走 LIKE 回退。

export interface NoteHit {
  noteId: string
  title: string
  scopeId: string
  scopeTitle: string | null
  snippet: string
}

export interface MessageHit {
  msgId: string
  convId: string
  convTitle: string
  scopeId: string
  scopeTitle: string | null
  snippet: string
}

const MAX_HITS = 50
const SHORT_QUERY_MAX_HITS = 20

// 关键词转成 FTS5 短语查询（内部引号转义，避免语法错误）
function toFtsQuery(keyword: string): string {
  return `"${keyword.replace(/"/g, '""')}"`
}

// trigram 至少需要 3 个字符
function isShortQuery(keyword: string): boolean {
  return Array.from(keyword).length < 3
}

/**
 * LIKE 字面匹配：转义 % _ \ 三个通配符，
 * 否则用户搜 "a_b" 会把 "axb" 也匹配出来。
 */
function toLikePattern(keyword: string): string {
  const escaped = keyword.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  return `%${escaped}%`
}

// 搜索笔记
export function searchNotes(keyword: string): NoteHit[] {
  const kw = keyword.trim()
  if (!kw) return []

  if (!isShortQuery(kw)) {
    try {
      return getDatabase()
        .prepare(
          `SELECT n.id AS noteId, n.title, n.scopeId, c.title AS scopeTitle,
                  snippet(notes_fts, 1, '<mark>', '</mark>', '…', 12) AS snippet
           FROM notes_fts
           JOIN notes n ON n.id = notes_fts.noteId
           LEFT JOIN ai_conversation c ON c.convId = n.scopeId
           WHERE notes_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(toFtsQuery(kw), MAX_HITS) as NoteHit[]
    } catch {
      // FTS5 查询出错（NFR-S5）：降级为 LIKE 字面匹配
    }
  }

  return getDatabase()
    .prepare(
      `SELECT n.id AS noteId, n.title, n.scopeId, c.title AS scopeTitle,
              substr(n.content, 1, 200) AS snippet
       FROM notes n
       LEFT JOIN ai_conversation c ON c.convId = n.scopeId
       WHERE n.content LIKE ? ESCAPE '\\'
       LIMIT ?`
    )
    .all(toLikePattern(kw), SHORT_QUERY_MAX_HITS) as NoteHit[]
}

// 搜索对话消息
export function searchMessages(keyword: string): MessageHit[] {
  const kw = keyword.trim()
  if (!kw) return []

  if (!isShortQuery(kw)) {
    try {
      return getDatabase()
        .prepare(
          `SELECT messages_fts.msgId, messages_fts.convId, c.title AS convTitle,
                  COALESCE(c.scopeId, c.convId) AS scopeId, s.title AS scopeTitle,
                  snippet(messages_fts, 2, '<mark>', '</mark>', '…', 12) AS snippet
           FROM messages_fts
           JOIN ai_conversation c ON c.convId = messages_fts.convId
           LEFT JOIN ai_conversation s ON s.convId = COALESCE(c.scopeId, c.convId)
           WHERE messages_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(toFtsQuery(kw), MAX_HITS) as MessageHit[]
    } catch {
      // FTS5 查询出错（NFR-S5）：降级为 LIKE 字面匹配
    }
  }

  return getDatabase()
    .prepare(
      `SELECT m.id AS msgId, m.convId, c.title AS convTitle,
              COALESCE(c.scopeId, c.convId) AS scopeId, s.title AS scopeTitle,
              substr(m.content, 1, 200) AS snippet
       FROM messages m
       JOIN ai_conversation c ON c.convId = m.convId
       LEFT JOIN ai_conversation s ON s.convId = COALESCE(c.scopeId, c.convId)
       WHERE m.content LIKE ? ESCAPE '\\'
       LIMIT ?`
    )
    .all(toLikePattern(kw), SHORT_QUERY_MAX_HITS) as MessageHit[]
}
