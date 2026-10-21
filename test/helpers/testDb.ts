import { createRequire } from 'node:module'

// Vite 5 的内置模块清单里没有 node:sqlite，走 require 绕过打包解析
const nodeRequire = createRequire(import.meta.url)
const { DatabaseSync } = nodeRequire('node:sqlite') as typeof import('node:sqlite')
type StatementSync = import('node:sqlite').StatementSync

/**
 * 测试用数据库。
 *
 * 生产环境用 better-sqlite3（编译为 Electron ABI，Node 进程无法加载），
 * 测试环境用 Node 内置的 node:sqlite —— 两者同为 SQLite：
 *   - 外键级联：better-sqlite3 编译时带 SQLITE_DEFAULT_FOREIGN_KEYS=1，node:sqlite 默认也是 ON
 *   - FTS5：两者都内置
 * 这里补上 better-sqlite3 独有的 transaction() 包装，让生产代码无需区分。
 */

type AnyFn = (...args: any[]) => any

export interface TestDb {
  exec(sql: string): void
  prepare(sql: string): StatementSync
  transaction<T extends AnyFn>(fn: T): T
  close(): void
}

export function createTestDb(): TestDb {
  const db = new DatabaseSync(':memory:') as unknown as TestDb

  db.transaction = ((fn: AnyFn) => {
    return (...args: any[]) => {
      db.exec('BEGIN')
      try {
        const result = fn(...args)
        db.exec('COMMIT')
        return result
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    }
  }) as TestDb['transaction']

  return db
}
