import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { sqlLogger as logger } from '../logger'

const DB_PATH = path.join(app.getPath('userData'), 'app.db')
const CURRENT_VERSION = 1

let db: Database.Database | null = null

function getMigrationsPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath!, 'migrations')
  }
  // dev: app.getAppPath() returns project root
  return path.join(app.getAppPath(), 'resources/migrations')
}

function getSetting(key: string): string | null {
  const row = db!.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setSetting(key: string, value: string): void {
  db!.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

function runMigration(v: number): void {
  const dir = getMigrationsPath()
  const files = fs.readdirSync(dir).filter(f => f.startsWith(`${v.toString().padStart(3, '0')}_`) && f.endsWith('.sql'))

  if (files.length === 0) {
    logger.error(`Migration ${v} not found in ${dir}`)
    return
  }

  const sql = fs.readFileSync(path.join(dir, files[0]), 'utf8')
  db!.exec(sql)
  logger.info(`[Database] Ran migration ${files[0]}`)
}

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  db = new Database(DB_PATH)

  // settings 表必须先建，用于存储 version
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `)

  let version = parseInt(getSetting('db_version') || '0', 10)

  for (let v = version + 1; v <= CURRENT_VERSION; v++) {
    runMigration(v)
  }

  setSetting('db_version', CURRENT_VERSION.toString())
  logger.info('[Database] Initialized at:', DB_PATH)

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
    logger.info('[Database] Closed')
  }
}
