/**
 * 辅助面板 —— IPC 层测试。
 *
 * 对应需求文档 docs/ASSISTANT_PANEL.md §10.1 追溯矩阵中「assistantIpc」标记的用例。
 * 直接调用 ipcMain.handle 注册的 handler，验证 IPC 契约。
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

import { ipcMain } from 'electron'
import { registerAIHandlers } from '../../electron/modules/ai/aiHandlers'
import { aiChannels } from '../../electron/modules/ai/ipcClient'
import { registerAssistantHandlers } from '../../electron/modules/assistant/handlers'
import { assistantChannels } from '../../electron/modules/assistant/ipcClient'
import { registerNotesHandlers } from '../../electron/modules/notes/handlers'
import { notesChannels } from '../../electron/modules/notes/ipcClient'
import { registerWorkspaceHandlers } from '../../electron/modules/workspace/handlers'
import { workspaceChannels } from '../../electron/modules/workspace/ipcClient'
import { registerSearchHandlers } from '../../electron/modules/search/handlers'
import { searchChannels } from '../../electron/modules/search/ipcClient'
import { appendMessage } from '../../electron/modules/ai/aiConversationDb'
import { getDatabase } from '../../electron/shared/database'

type Handler = (event: unknown, ...args: any[]) => any

function getHandler(channel: string): Handler {
  const call = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`handler not registered: ${channel}`)
  return call[1] as Handler
}

function invoke(channel: string, ...args: any[]): Promise<any> {
  return getHandler(channel)(null, ...args)
}

const db = getDatabase()

function resetDb() {
  db.exec('DELETE FROM notes_fts')
  db.exec('DELETE FROM notes')
  db.exec('DELETE FROM messages_fts')
  db.exec('DELETE FROM messages')
  db.exec('DELETE FROM workspace_state')
  db.exec('DELETE FROM ai_conversation')
}

function countRows(table: string, where: string, arg: unknown): number {
  const row = db.prepare(`SELECT count(*) AS c FROM ${table} WHERE ${where}`).get(arg)
  return (row as { c: number }).c
}

/** 工作区 scopeId 就是主会话的 convId */
let scopeA: string
let scopeB: string

beforeEach(async () => {
  vi.mocked(ipcMain.handle).mockClear()
  resetDb()
  registerAIHandlers()
  registerAssistantHandlers()
  registerNotesHandlers()
  registerWorkspaceHandlers()
  registerSearchHandlers()
  scopeA = (await invoke(aiChannels.create, '主会话A')).convId
  scopeB = (await invoke(aiChannels.create, '主会话B')).convId
})

describe('FLOW-1 打开面板并加载工作区', () => {
  it('assistant:list 只返回该工作区的辅助会话', async () => {
    const a1 = await invoke(assistantChannels.create, scopeA)
    await invoke(assistantChannels.create, scopeB)

    const result = await invoke(assistantChannels.list, scopeA)

    expect(result.map((s: any) => s.convId)).toEqual([a1.convId])
  })

  it('assistant:create 建立的会话 isAssistant=1 且归属该工作区', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)

    const row = db.prepare('SELECT isAssistant, scopeId FROM ai_conversation WHERE convId = ?').get(convId)
    expect(row).toEqual({ isAssistant: 1, scopeId: scopeA })
  })

  it('notes:list 只返回该工作区的笔记', async () => {
    await invoke(notesChannels.create, { scopeId: scopeA, title: 'A' })
    await invoke(notesChannels.create, { scopeId: scopeB, title: 'B' })

    const result = await invoke(notesChannels.list, scopeA)

    expect(result.map((n: any) => n.title)).toEqual(['A'])
  })

  it('workspace:getState 对未初始化工作区返回空状态', async () => {
    const state = await invoke(workspaceChannels.getState, scopeA)

    expect(state).toEqual({ scopeId: scopeA, activeConvId: null, activeNoteId: null })
  })

  it('workspace:setActive 写入后可读回', async () => {
    const assistant = await invoke(assistantChannels.create, scopeA)
    const note = await invoke(notesChannels.create, { scopeId: scopeA })

    await invoke(workspaceChannels.setActive, scopeA, { convId: assistant.convId, noteId: note.id })

    const state = await invoke(workspaceChannels.getState, scopeA)

    expect(state.activeConvId).toBe(assistant.convId)
    expect(state.activeNoteId).toBe(note.id)
  })
})

describe('FLOW-11 首次进入工作区', () => {
  it('空工作区创建辅助会话并激活', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)

    const list = await invoke(assistantChannels.list, scopeA)
    const state = await invoke(workspaceChannels.getState, scopeA)

    expect(list).toHaveLength(1)
    expect(state.activeConvId).toBe(convId)
  })
})

describe('FLOW-2 辅助会话对话', () => {
  it('assistant:getMessages 返回指定会话的消息', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)
    appendMessage(convId, 'm1', 'user', '你好', 1)

    const result = await invoke(assistantChannels.getMessages, convId)

    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('你好')
  })

  it('assistant:rename 更新会话标题', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)

    await invoke(assistantChannels.rename, convId, '新标题')

    const row = db.prepare('SELECT title FROM ai_conversation WHERE convId = ?').get(convId)
    expect(row).toEqual({ title: '新标题' })
  })
})

describe('FLOW-3 摘录为笔记', () => {
  it('notes:create 携带快照字段时快照被持久化', async () => {
    const note = await invoke(notesChannels.create, {
      scopeId: scopeA,
      title: '索引结论',
      content: '<p>正文</p>',
      sourceType: 'ai_message',
      sourceConvId: 'conv-a1',
      sourceMsgId: 'm1',
      sourceConvTitle: '性能优化',
      sourceMsgContent: '这里讨论了索引优化',
    })

    expect(note.sourceConvTitle).toBe('性能优化')
    expect(note.sourceMsgContent).toBe('这里讨论了索引优化')

    const row = db.prepare('SELECT sourceConvTitle, sourceMsgContent FROM notes WHERE id = ?').get(note.id)
    expect(row).toEqual({ sourceConvTitle: '性能优化', sourceMsgContent: '这里讨论了索引优化' })
  })

  it('notes:get 返回指定笔记', async () => {
    const created = await invoke(notesChannels.create, { scopeId: scopeA, title: 'A' })

    const result = await invoke(notesChannels.get, created.id)

    expect(result.title).toBe('A')
  })
})

describe('FLOW-4 编辑并保存笔记', () => {
  it('notes:update 更新标题与正文', async () => {
    const created = await invoke(notesChannels.create, { scopeId: scopeA, title: '旧', content: '<p>旧</p>' })

    const updated = await invoke(notesChannels.update, created.id, {
      title: '新',
      content: '<p>新</p>',
    })

    expect(updated.title).toBe('新')
    expect(updated.content).toBe('<p>新</p>')
  })

  it('notes:update 内容超 1MB 时抛错且不落库', async () => {
    const created = await invoke(notesChannels.create, { scopeId: scopeA, content: '<p>原内容</p>' })

    await expect(
      invoke(notesChannels.update, created.id, { content: 'x'.repeat(1024 * 1024 + 1) })
    ).rejects.toThrow()

    const row = db.prepare('SELECT content FROM notes WHERE id = ?').get(created.id)
    expect(row).toEqual({ content: '<p>原内容</p>' })
  })
})

describe('FLOW-6 两个工作区互不干扰', () => {
  it('切换 scope 后各自只看到自己的数据', async () => {
    await invoke(assistantChannels.create, scopeA)
    await invoke(assistantChannels.create, scopeB)
    await invoke(notesChannels.create, { scopeId: scopeA, title: 'A的笔记' })
    await invoke(notesChannels.create, { scopeId: scopeB, title: 'B的笔记' })

    const a = await invoke(notesChannels.list, scopeA)
    const b = await invoke(notesChannels.list, scopeB)

    expect(a.map((n: any) => n.title)).toEqual(['A的笔记'])
    expect(b.map((n: any) => n.title)).toEqual(['B的笔记'])
  })
})

describe('FLOW-7 搜索', () => {
  it('search:query 跨工作区同时命中笔记与消息', async () => {
    const assistant = await invoke(assistantChannels.create, scopeA)
    await invoke(notesChannels.create, {
      scopeId: scopeA,
      title: '索引结论',
      content: '关于索引优化的结论',
    })
    appendMessage(assistant.convId, 'm1', 'user', '这里讨论了索引优化的方案', 1)

    const result = await invoke(searchChannels.query, '索引优化')

    expect(result.notes).toHaveLength(1)
    expect(result.messages).toHaveLength(1)
    expect(result.notes[0].scopeTitle).toBe('主会话A')
    expect(result.messages[0].scopeTitle).toBe('主会话A')
  })

  it('含特殊字符的关键词不抛错', async () => {
    await expect(invoke(searchChannels.query, '索引"优化')).resolves.toBeTruthy()
    await expect(invoke(searchChannels.query, '')).resolves.toBeTruthy()
  })

  it('短关键词的 LIKE 回退把 % 当字面量', async () => {
    await invoke(notesChannels.create, { scopeId: scopeA, content: '进度 100% 完成' })
    await invoke(notesChannels.create, { scopeId: scopeA, content: '进度 xx 完成' })

    // '%' 是 1 个字符，走 LIKE 回退；若未转义，% 会被当成通配符匹配到第二条
    const result = await invoke(searchChannels.query, '%')

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].snippet).toContain('100%')
  })
})

describe('FLOW-8 删除辅助会话', () => {
  it('删除会话本身', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)

    await invoke(assistantChannels.deleteSession, convId)

    const row = db.prepare('SELECT * FROM ai_conversation WHERE convId = ?').get(convId)
    expect(row).toBeUndefined()
  })

  it('级联删除会话的消息，不留孤儿', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)
    appendMessage(convId, 'm1', 'user', '你好', 1)

    await invoke(assistantChannels.deleteSession, convId)

    expect(countRows('messages', 'convId = ?', convId)).toBe(0)
    expect(countRows('messages_fts', 'convId = ?', convId)).toBe(0)
  })

  it('该工作区的笔记保留', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)
    const note = await invoke(notesChannels.create, { scopeId: scopeA, title: '要保留' })

    await invoke(assistantChannels.deleteSession, convId)

    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(note.id)
    expect(row).toBeTruthy()
  })

  it('删除后 activeConvId 被置空', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)

    await invoke(assistantChannels.deleteSession, convId)

    const state = await invoke(workspaceChannels.getState, scopeA)
    expect(state.activeConvId).toBeNull()
  })
})

describe('FLOW-9 删除主会话的级联', () => {
  it('清空其辅助会话与消息', async () => {
    const assistant = await invoke(assistantChannels.create, scopeA)
    appendMessage(assistant.convId, 'm1', 'user', '你好', 1)

    await invoke(aiChannels.delete, scopeA)

    expect(db.prepare('SELECT * FROM ai_conversation WHERE convId = ?').get(assistant.convId)).toBeUndefined()
    expect(countRows('messages', 'convId = ?', assistant.convId)).toBe(0)
  })

  it('清空其工作区的笔记', async () => {
    await invoke(notesChannels.create, { scopeId: scopeA, title: '要删' })

    await invoke(aiChannels.delete, scopeA)

    expect(countRows('notes', 'scopeId = ?', scopeA)).toBe(0)
  })

  it('清空 workspace_state', async () => {
    await invoke(workspaceChannels.setActive, scopeA, { convId: 'x' })

    await invoke(aiChannels.delete, scopeA)

    expect(countRows('workspace_state', 'scopeId = ?', scopeA)).toBe(0)
  })

  it('不影响其他工作区', async () => {
    const assistantB = await invoke(assistantChannels.create, scopeB)
    const noteB = await invoke(notesChannels.create, { scopeId: scopeB, title: 'B的笔记' })

    await invoke(aiChannels.delete, scopeA)

    expect(db.prepare('SELECT * FROM ai_conversation WHERE convId = ?').get(assistantB.convId)).toBeTruthy()
    expect(db.prepare('SELECT * FROM notes WHERE id = ?').get(noteB.id)).toBeTruthy()
  })

  it('删除目录时同样清空其工作区，不留孤儿', async () => {
    const category = await invoke(aiChannels.createCategory, '待删目录')
    await invoke(aiChannels.moveSession, scopeA, category.id)
    const assistant = await invoke(assistantChannels.create, scopeA)
    await invoke(notesChannels.create, { scopeId: scopeA, title: '要删' })

    await invoke(aiChannels.deleteCategoryWithSessions, category.id)

    expect(db.prepare('SELECT * FROM ai_conversation WHERE convId = ?').get(assistant.convId)).toBeUndefined()
    expect(countRows('notes', 'scopeId = ?', scopeA)).toBe(0)
    expect(countRows('workspace_state', 'scopeId = ?', scopeA)).toBe(0)
  })
})

describe('归属校验：渲染进程不能越权操作', () => {
  it('assistant:deleteSession 拒绝删除主会话', async () => {
    const result = await invoke(assistantChannels.deleteSession, scopeA)

    expect(result).toBe(false)
    expect(db.prepare('SELECT * FROM ai_conversation WHERE convId = ?').get(scopeA)).toBeTruthy()
  })

  it('assistant:rename 拒绝改主会话标题', async () => {
    const result = await invoke(assistantChannels.rename, scopeA, '被篡改')

    expect(result).toBe(false)
    const row = db.prepare('SELECT title FROM ai_conversation WHERE convId = ?').get(scopeA)
    expect(row).toEqual({ title: '主会话A' })
  })

  it('assistant:create 拒绝不存在的工作区', async () => {
    const result = await invoke(assistantChannels.create, '9999999999999-abcdef12')

    expect(result).toBeNull()
  })

  it('assistant:create 拒绝把辅助会话当作工作区', async () => {
    const { convId } = await invoke(assistantChannels.create, scopeA)

    const result = await invoke(assistantChannels.create, convId)

    expect(result).toBeNull()
  })

  it('notes:create 拒绝不存在的工作区', async () => {
    await expect(
      invoke(notesChannels.create, { scopeId: '9999999999999-abcdef12', title: '孤儿笔记' })
    ).rejects.toThrow()
    expect(countRows('notes', 'scopeId = ?', '9999999999999-abcdef12')).toBe(0)
  })

  it('notes:delete 拒绝不存在的笔记', async () => {
    const result = await invoke(notesChannels.delete, 'note-9999999999999-abcdef12')

    expect(result).toBe(false)
  })
})

describe('安全：参数化查询', () => {
  it('恶意 convId 不破坏表结构', async () => {
    const malicious = "conv-x'; DROP TABLE ai_conversation; --"

    await expect(invoke(assistantChannels.getMessages, malicious)).resolves.toEqual([])

    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_conversation'")
      .get()
    expect(tableExists).toBeTruthy()
  })

  it('恶意 scopeId 不破坏表结构', async () => {
    const malicious = "x'; DROP TABLE notes; --"

    await expect(invoke(notesChannels.list, malicious)).resolves.toEqual([])

    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
      .get()
    expect(tableExists).toBeTruthy()
  })
})
