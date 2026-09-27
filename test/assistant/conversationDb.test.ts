import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

const { tempDir } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('node:os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-test-'))
  return { tempDir: dir }
})

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return tempDir
      if (name === 'downloads') return tempDir
      return tempDir
    },
  },
}))

import fs from 'node:fs'
import { getDatabase, closeDatabase } from '../../electron/shared/database'
import * as convDb from '../../electron/modules/assistant/conversationDb'
// 触发 ./db 副作用，建表
import '../../electron/modules/assistant'

afterAll(() => {
  closeDatabase()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

beforeEach(() => {
  const db = getDatabase()
  // 重置三张表（顺序：先清子表再清父表，避开 FK 约束）
  db.exec('DELETE FROM assistant_messages')
  db.exec('DELETE FROM assistant_links')
  db.exec('DELETE FROM assistant_conversations')
})

describe('createAssistantConv / getAssistantConv', () => {
  it('插入后能按 convId 查询到完整字段', () => {
    convDb.createAssistantConv('c-1', 'AI 辅助', 'url', 'https://example.com', 1000)

    const found = convDb.getAssistantConv('c-1')
    expect(found).toMatchObject({
      convId: 'c-1',
      title: 'AI 辅助',
      sourceType: 'url',
      sourceId: 'https://example.com',
      createdAt: 1000,
      updatedAt: 1000,
    })
  })

  it('查询不存在的 convId 返回 undefined', () => {
    expect(convDb.getAssistantConv('not-exist')).toBeUndefined()
  })
})

describe('updateAssistantTitle', () => {
  it('更新标题后能查到新值，updatedAt 同步刷新', () => {
    convDb.createAssistantConv('c-1', 'old', null, null, 1000)

    convDb.updateAssistantTitle('c-1', 'new', 2000)

    const found = convDb.getAssistantConv('c-1')
    expect(found?.title).toBe('new')
    expect(found?.updatedAt).toBe(2000)
  })
})

describe('addAssistantMessage', () => {
  it('插入消息后能按 createdAt ASC 排序查询', () => {
    convDb.createAssistantConv('c-1', 'AI 辅助', null, null, 1000)
    convDb.addAssistantMessage('m-1', 'c-1', 'user', 'hi', 1100)
    convDb.addAssistantMessage('m-2', 'c-1', 'assistant', 'hello', 1200)
    convDb.addAssistantMessage('m-3', 'c-1', 'user', 'bye', 1300)

    const msgs = convDb.getAssistantMessages('c-1')
    expect(msgs.map(m => m.id)).toEqual(['m-1', 'm-2', 'm-3'])
    expect(msgs.map(m => m.content)).toEqual(['hi', 'hello', 'bye'])
  })

  it('addAssistantMessage 会刷新 conv 的 updatedAt，且不覆盖 title', () => {
    convDb.createAssistantConv('c-1', 'AI 辅助', null, null, 1000)
    convDb.updateAssistantTitle('c-1', 'updated', 1500)

    convDb.addAssistantMessage('m-1', 'c-1', 'user', 'hi', 2000)

    const found = convDb.getAssistantConv('c-1')
    expect(found?.updatedAt).toBe(2000)
    expect(found?.title).toBe('updated')
  })

  it('空 conv 查询消息返回空数组', () => {
    convDb.createAssistantConv('c-1', 'AI 辅助', null, null, 1000)
    expect(convDb.getAssistantMessages('c-1')).toEqual([])
  })
})

describe('createLink / getLinkForSource / getConvIdForSource', () => {
  it('createLink 后 getLinkForSource 能查到', () => {
    convDb.createLink('url', 'https://example.com', 'c-1', 1000)

    const link = convDb.getLinkForSource('url', 'https://example.com')
    expect(link).toMatchObject({
      sourceType: 'url',
      sourceId: 'https://example.com',
      assistantConvId: 'c-1',
      createdAt: 1000,
    })
  })

  it('getConvIdForSource 是 getLinkForSource 的 convId 包装', () => {
    convDb.createLink('conversation', 'conv-xyz', 'c-1', 1000)

    expect(convDb.getConvIdForSource('conversation', 'conv-xyz')).toBe('c-1')
  })

  it('同一 sourceType+sourceId 重复 createLink 不会重复插入（UNIQUE + INSERT OR IGNORE）', () => {
    const db = getDatabase()
    convDb.createLink('url', 'https://example.com', 'c-1', 1000)
    convDb.createLink('url', 'https://example.com', 'c-2', 2000)

    // 两个 link 调用都不抛错，但只有第一条进库
    const allLinks = db.prepare('SELECT * FROM assistant_links').all()
    expect(allLinks).toHaveLength(1)
    expect(allLinks[0].assistantConvId).toBe('c-1')
  })

  it('不同 sourceId 可以并存', () => {
    const db = getDatabase()
    convDb.createLink('url', 'https://a.com', 'c-1', 1000)
    convDb.createLink('url', 'https://b.com', 'c-2', 2000)

    expect(db.prepare('SELECT COUNT(*) AS n FROM assistant_links').get()).toMatchObject({ n: 2 })
  })

  it('查询不存在的 link 返回 undefined', () => {
    expect(convDb.getLinkForSource('url', 'not-exist')).toBeUndefined()
    expect(convDb.getConvIdForSource('url', 'not-exist')).toBeUndefined()
  })
})

describe('deleteAssistantConv（级联删除 + 事务）', () => {
  it('删除 conv 时级联删除 messages 和 links', () => {
    convDb.createAssistantConv('c-1', 'AI 辅助', 'url', 'https://example.com', 1000)
    convDb.createLink('url', 'https://example.com', 'c-1', 1000)
    convDb.addAssistantMessage('m-1', 'c-1', 'user', 'hi', 1100)
    convDb.addAssistantMessage('m-2', 'c-1', 'assistant', 'hello', 1200)

    convDb.deleteAssistantConv('c-1')

    expect(convDb.getAssistantConv('c-1')).toBeUndefined()
    expect(convDb.getAssistantMessages('c-1')).toEqual([])
    expect(convDb.getLinkForSource('url', 'https://example.com')).toBeUndefined()
  })

  it('删除不存在的 conv 不抛错', () => {
    expect(() => convDb.deleteAssistantConv('not-exist')).not.toThrow()
  })

  it('只删除目标 conv，不影响其他 conv 的 messages 和 links', () => {
    convDb.createAssistantConv('c-1', 'A', null, null, 1000)
    convDb.createAssistantConv('c-2', 'B', null, null, 1000)
    convDb.createLink('url', 'https://a.com', 'c-1', 1000)
    convDb.createLink('url', 'https://b.com', 'c-2', 1000)
    convDb.addAssistantMessage('m-1', 'c-1', 'user', 'a-msg', 1100)
    convDb.addAssistantMessage('m-2', 'c-2', 'user', 'b-msg', 1100)

    convDb.deleteAssistantConv('c-1')

    expect(convDb.getAssistantConv('c-1')).toBeUndefined()
    expect(convDb.getAssistantConv('c-2')).toBeDefined()
    expect(convDb.getAssistantMessages('c-1')).toEqual([])
    expect(convDb.getAssistantMessages('c-2').map(m => m.id)).toEqual(['m-2'])
    expect(convDb.getLinkForSource('url', 'https://a.com')).toBeUndefined()
    expect(convDb.getLinkForSource('url', 'https://b.com')).toBeDefined()
  })
})