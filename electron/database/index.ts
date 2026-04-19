import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

const DB_PATH = path.join(app.getPath('userData'), 'app.db')

let db: Database.Database | null = null

// ============ 表初始化 ============

function initTabsTable(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `)
}

function initHistoryTable(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      visitedAt INTEGER NOT NULL
    )
  `)
}

function initAIConversationTable(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS ai_conversation (
      convId TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '新会话',
      messages TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `)
}

// ============ 核心导出 ============

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  db = new Database(DB_PATH)

  // 初始化所有表
  initTabsTable()
  initHistoryTable()
  initAIConversationTable()

  console.log('[Database] Initialized at:', DB_PATH)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[Database] Closed')
  }
}
