import { getDatabase } from '../../shared/database'

const db = getDatabase()

// 辅助会话表
db.exec(`
  CREATE TABLE IF NOT EXISTS assistant_conversations (
    convId      TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'AI 辅助',
    sourceType  TEXT,
    sourceId    TEXT,
    createdAt   INTEGER NOT NULL,
    updatedAt   INTEGER NOT NULL
  )
`)

// 辅助消息表
db.exec(`
  CREATE TABLE IF NOT EXISTS assistant_messages (
    id          TEXT PRIMARY KEY,
    convId      TEXT NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    createdAt   INTEGER NOT NULL
  )
`)

// 关联表
db.exec(`
  CREATE TABLE IF NOT EXISTS assistant_links (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sourceType      TEXT NOT NULL,
    sourceId        TEXT NOT NULL,
    assistantConvId TEXT NOT NULL,
    createdAt       INTEGER NOT NULL,
    UNIQUE(sourceType, sourceId)
  )
`)

db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_links_source ON assistant_links(sourceType, sourceId)')
db.exec('CREATE INDEX IF NOT EXISTS idx_assistant_messages_convId ON assistant_messages(convId)')
