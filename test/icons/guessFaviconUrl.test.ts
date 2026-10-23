/**
 * favicon 位置猜测的回归测试。
 *
 * 快捷方式指向的站点往往从没被打开过，page_icons 表里没有缓存，
 * 只能按约定路径探测 —— 猜错就是"永远拿不到图标"。
 */
import { describe, it, expect, vi } from 'vitest'

// iconsDb 在 import 时建表，会触发真实 better-sqlite3（Electron ABI，Node 加载不了）
vi.mock('../../electron/shared/database', async () => {
  const { createTestDb } = await import('../helpers/testDb')
  const db = createTestDb()
  return {
    getDatabase: () => db,
    initDatabase: () => db,
    closeDatabase: () => {},
  }
})

import { guessFaviconUrl } from '../../electron/modules/icons/manager'

describe('guessFaviconUrl', () => {
  it('探测 origin 根下的 favicon.ico', () => {
    expect(guessFaviconUrl('https://example.com')).toBe('https://example.com/favicon.ico')
    expect(guessFaviconUrl('https://example.com/a/b?q=1')).toBe('https://example.com/favicon.ico')
  })

  it('保留端口', () => {
    expect(guessFaviconUrl('http://localhost:5273/x')).toBe('http://localhost:5273/favicon.ico')
  })

  it('拒绝非 http/https', () => {
    expect(guessFaviconUrl('file:///c:/icon.png')).toBeNull()
    expect(guessFaviconUrl('lsqapp://internal-app/newtab')).toBeNull()
  })

  it('拒绝非法网址', () => {
    expect(guessFaviconUrl('not a url')).toBeNull()
  })
})
