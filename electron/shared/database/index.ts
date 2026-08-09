import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

const DB_PATH = path.join(app.getPath('userData'), 'app.db')

let db: Database.Database | null = null

// ============ 表初始化 ============

function initHistoryTable(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      visitedAt INTEGER NOT NULL,
      favicon TEXT
    )
  `)

  // 给已存在的表添加 favicon 列（如果不存在）
  try {
    getDatabase().exec('ALTER TABLE history ADD COLUMN favicon TEXT')
  } catch {
    // 列已存在，忽略
  }
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
  // 迁移：添加 pinned 列
  const cols = getDatabase().prepare(`PRAGMA table_info(ai_conversation)`).all() as { name: string }[]
  if (!cols.some(c => c.name === 'pinned')) {
    getDatabase().exec(`ALTER TABLE ai_conversation ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`)
  }
}

function initSettingsTable(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `)
}

function initFavoritesTable(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      favicon TEXT,
      createdAt INTEGER NOT NULL
    )
  `)
  // 迁移：添加 favicon 列（如果不存在）
  try {
    getDatabase().exec('ALTER TABLE favorites ADD COLUMN favicon TEXT')
  } catch {
    // 列已存在，忽略
  }
  // 添加 url 索引，加速查询
  getDatabase().exec('CREATE INDEX IF NOT EXISTS idx_favorites_url ON favorites(url)')
}

function initDownloadsTable(): void {
  // 检查老 schema 是否有 source 列 (旧版本带 source/method/post_body/headers/http 路径)
  // 启动时把老表备份 + 重建, 把还在用的列拷过去, 删掉废弃列
  const cols = getDatabase()
    .prepare(`PRAGMA table_info(downloads)`)
    .all() as { name: string }[]
  const colNames = new Set(cols.map((c) => c.name))
  const hasLegacy = colNames.has('source') || !colNames.has('method')

  if (hasLegacy && colNames.has('id')) {
    // 老表存在, 列定义不匹配. 备份 + 重建 + 拷贝数据 (只保留还活着的列)
    getDatabase().exec(`ALTER TABLE downloads RENAME TO downloads__legacy`)
    getDatabase().exec(`
      CREATE TABLE downloads (
        id              TEXT    PRIMARY KEY,
        url             TEXT    NOT NULL,
        method          TEXT    NOT NULL DEFAULT 'GET',
        post_body       TEXT,
        headers         TEXT    NOT NULL DEFAULT '{}',
        filename        TEXT    NOT NULL,
        save_dir        TEXT    NOT NULL,
        total_bytes     INTEGER,
        received_bytes  INTEGER NOT NULL DEFAULT 0,
        status          TEXT    NOT NULL,
        error           TEXT,
        referrer        TEXT,
        mime_type       TEXT,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      )
    `)
    // 拷贝仍在的列. 老数据可能是任意 status, 这里都保留 (init 路径不再做 status 强制转换)
    const sourceCols = new Set(colNames)
    const want = ['id', 'url', 'method', 'post_body', 'headers', 'filename', 'save_dir',
      'total_bytes', 'received_bytes', 'status', 'error', 'referrer', 'mime_type',
      'created_at', 'updated_at']
    const copyCols = want.filter((c) => sourceCols.has(c))
    const colList = copyCols.join(', ')
    getDatabase().exec(
      `INSERT INTO downloads (${colList}) SELECT ${colList} FROM downloads__legacy`
    )
    getDatabase().exec(`DROP TABLE downloads__legacy`)
  } else {
    // 新表或空, 直接 CREATE TABLE IF NOT EXISTS
    getDatabase().exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id              TEXT    PRIMARY KEY,
        url             TEXT    NOT NULL,
        method          TEXT    NOT NULL DEFAULT 'GET',
        post_body       TEXT,
        headers         TEXT    NOT NULL DEFAULT '{}',
        filename        TEXT    NOT NULL,
        save_dir        TEXT    NOT NULL,
        total_bytes     INTEGER,
        received_bytes  INTEGER NOT NULL DEFAULT 0,
        status          TEXT    NOT NULL,
        error           TEXT,
        referrer        TEXT,
        mime_type       TEXT,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      )
    `)
  }
  getDatabase().exec(
    `CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status)`
  )
  getDatabase().exec(
    `CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC)`
  )
}

// ============ 核心导出 ============

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  db = new Database(DB_PATH)

  // 初始化所有表
  initHistoryTable()
  initAIConversationTable()
  initSettingsTable()
  initDownloadsTable()
  initFavoritesTable()

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
