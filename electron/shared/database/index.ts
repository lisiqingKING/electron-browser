import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'
import { sqlLogger as logger } from '../logger'

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'app.db')
}

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const DB_PATH = getDbPath()
  db = new Database(DB_PATH)
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
