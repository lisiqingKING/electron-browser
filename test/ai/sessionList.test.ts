/**
 * 会话列表（置顶语义 + 分页排序）的回归测试。
 *
 * 背景一：置顶曾经有两套并存表示（pinned 字段 / categoryId = '__pinned__'），
 * 两套不同步会让同一个会话既不在置顶组、也不在默认组 —— 从侧边栏里直接消失。
 * 现在 categoryId 是唯一判据，pinned 退化成它的冗余副本。
 *
 * 背景二：会话列表是全量返回的，排序必须稳定 —— updatedAt 相同（同一毫秒）时
 * 没有 tiebreaker 的排序在两次查询之间可能给出不同顺序。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../electron/shared/database', async () => {
  const { createTestDb } = await import('../helpers/testDb')
  const db = createTestDb()
  return {
    getDatabase: () => db,
    initDatabase: () => db,
    closeDatabase: () => {},
  }
})

import '../../electron/modules/ai/aiDb'
import { alignPinnedCategory, touchConversation } from '../../electron/modules/ai/aiDb'
import {
  createChatSession,
  updateSessionCategory,
  updatePinned,
  updateTitle,
  getChatSessionByConvId,
  getAllChatSessions,
} from '../../electron/modules/ai/aiConversationDb'
import { PINNED_CATEGORY_ID } from '../../electron/shared/constants'
import { getDatabase } from '../../electron/shared/database'

const db = getDatabase()
const NOW = 1_700_000_000_000

function makeSession(convId: string, categoryId: string | null = null) {
  createChatSession(convId, {
    title: convId,
    createdAt: NOW,
    updatedAt: NOW,
    categoryId,
    scopeId: null,
    ord: 0,
  })
}

function row(convId: string) {
  return db
    .prepare('SELECT pinned, categoryId FROM ai_conversation WHERE convId = ?')
    .get(convId) as { pinned: number; categoryId: string | null }
}

describe('置顶语义', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ai_conversation')
  })

  it('移入置顶分组时 pinned 同步为 1', () => {
    makeSession('c1')
    updateSessionCategory('c1', PINNED_CATEGORY_ID)

    expect(row('c1')).toEqual({ pinned: 1, categoryId: PINNED_CATEGORY_ID })
  })

  it('移出置顶分组时 pinned 同步为 0', () => {
    makeSession('c1', PINNED_CATEGORY_ID)
    updateSessionCategory('c1', null)

    expect(row('c1')).toEqual({ pinned: 0, categoryId: null })
  })

  it('移入普通目录时 pinned 归零（置顶和目录互斥）', () => {
    makeSession('c1', PINNED_CATEGORY_ID)
    updateSessionCategory('c1', 'cat-1')

    expect(row('c1')).toEqual({ pinned: 0, categoryId: 'cat-1' })
  })

  it('旧接口 updatePinned 走的是同一套表示', () => {
    makeSession('c1')
    updatePinned('c1', 1)
    expect(row('c1')).toEqual({ pinned: 1, categoryId: PINNED_CATEGORY_ID })

    updatePinned('c1', 0)
    expect(row('c1')).toEqual({ pinned: 0, categoryId: null })
  })

  it('建会话时 pinned 就是 categoryId 的副本', () => {
    makeSession('c1', PINNED_CATEGORY_ID)
    expect(row('c1').pinned).toBe(1)
  })

  it('对齐存量数据：只标了 pinned 的会话归入置顶分组', () => {
    db.prepare(
      `INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant)
       VALUES (?, ?, ?, ?, 1, NULL, 0)`
    ).run('legacy', '老数据', NOW, NOW)

    alignPinnedCategory()

    expect(row('legacy')).toEqual({ pinned: 1, categoryId: PINNED_CATEGORY_ID })
  })

  it('对齐存量数据：已进目录的会话 pinned 归零（目录优先）', () => {
    db.prepare(
      `INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant)
       VALUES (?, ?, ?, ?, 1, 'cat-1', 0)`
    ).run('legacy2', '老数据2', NOW, NOW)

    alignPinnedCategory()

    expect(row('legacy2')).toEqual({ pinned: 0, categoryId: 'cat-1' })
  })

  it('对齐是幂等的', () => {
    db.prepare(
      `INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant)
       VALUES (?, ?, ?, ?, 1, NULL, 0)`
    ).run('legacy3', '老数据3', NOW, NOW)

    alignPinnedCategory()
    alignPinnedCategory()

    expect(row('legacy3')).toEqual({ pinned: 1, categoryId: PINNED_CATEGORY_ID })
  })

  it('辅助会话不参与置顶对齐', () => {
    db.prepare(
      `INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant, scopeId)
       VALUES (?, ?, ?, ?, 1, NULL, 1, ?)`
    ).run('assistant', '辅助会话', NOW, NOW, 'main')

    alignPinnedCategory()

    expect(row('assistant')).toEqual({ pinned: 1, categoryId: null })
  })

  it('会话读出来的 pinned 与 categoryId 一致', () => {
    makeSession('c1')
    updateSessionCategory('c1', PINNED_CATEGORY_ID)

    const session = getChatSessionByConvId('c1')!
    expect(session.pinned).toBe(1)
    expect(session.categoryId).toBe(PINNED_CATEGORY_ID)
  })
})

describe('updatedAt 只由消息活动更新', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ai_conversation')
  })

  it('移动分组不改 updatedAt', () => {
    makeSession('c1')
    const before = getChatSessionByConvId('c1')!.updatedAt

    updateSessionCategory('c1', 'cat-1')

    expect(getChatSessionByConvId('c1')!.updatedAt).toBe(before)
  })

  it('置顶不改 updatedAt', () => {
    makeSession('c1')
    const before = getChatSessionByConvId('c1')!.updatedAt

    updatePinned('c1', 1)

    expect(getChatSessionByConvId('c1')!.updatedAt).toBe(before)
  })

  it('改名不改 updatedAt', () => {
    makeSession('c1')
    const before = getChatSessionByConvId('c1')!.updatedAt

    updateTitle('c1', '新标题')

    expect(getChatSessionByConvId('c1')!.updatedAt).toBe(before)
  })

  it('发消息才改 updatedAt', () => {
    makeSession('c1')
    const before = getChatSessionByConvId('c1')!.updatedAt

    touchConversation('c1', before + 1000)

    expect(getChatSessionByConvId('c1')!.updatedAt).toBe(before + 1000)
  })
})

describe('列表排序', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ai_conversation')
  })

  it('updatedAt 相同时按 convId 兜底排序，两次查询顺序一致', () => {
    // 同一毫秒创建的两个会话：没有 tiebreaker 时顺序不确定，
    // 同一份数据两次读出来顺序可能不同
    db.prepare(
      `INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant)
       VALUES (?, ?, ?, ?, 0, NULL, 0)`
    ).run('a-same', 'A', NOW, NOW)
    db.prepare(
      `INSERT INTO ai_conversation (convId, title, createdAt, updatedAt, pinned, categoryId, isAssistant)
       VALUES (?, ?, ?, ?, 0, NULL, 0)`
    ).run('b-same', 'B', NOW, NOW)

    const first = getAllChatSessions().map((s) => s.convId)
    const second = getAllChatSessions().map((s) => s.convId)

    expect(first).toEqual(['b-same', 'a-same'])
    expect(second).toEqual(first)
  })

  it('一次返回全部分组及其会话（不截断）', () => {
    for (let i = 0; i < 30; i++) {
      makeSession(`c${i}`, i % 2 === 0 ? 'cat-1' : null)
    }

    const all = getAllChatSessions()
    expect(all).toHaveLength(30)
    expect(all.filter((s) => s.categoryId === 'cat-1')).toHaveLength(15)
  })

  it('置顶的会话排在前面', () => {
    makeSession('normal')
    makeSession('pinned', PINNED_CATEGORY_ID)

    const ids = getAllChatSessions().map((s) => s.convId)
    expect(ids[0]).toBe('pinned')
  })
})
