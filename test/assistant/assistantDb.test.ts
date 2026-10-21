/**
 * 辅助面板 —— 数据层测试。
 *
 * 对应需求文档 docs/ASSISTANT_PANEL.md §10.1 追溯矩阵中「assistantDb」标记的用例。
 *
 * 运行时用 node:sqlite 内存库（生产用 better-sqlite3，编译为 Electron ABI，Node 进程加载不了）。
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

// 副作用导入：创建 ai_conversation / messages 表
import '../../electron/modules/ai/aiDb'
import {
  createChatSession,
  getAssistantChatSessions,
  updateConversationOrd,
  appendMessage,
  getMessagesByConvId,
  deleteConversationData,
} from '../../electron/modules/ai/aiConversationDb'
import {
  createNote,
  getNote,
  getNotesByScope,
  updateNote,
  deleteNote,
  updateNoteOrd,
  deleteNotesByScope,
} from '../../electron/modules/notes/notesDb'
import {
  getWorkspaceState,
  setWorkspaceActive,
  deleteWorkspaceState,
} from '../../electron/modules/workspace/workspaceDb'
import { searchNotes, searchMessages } from '../../electron/modules/search/searchDb'
import { getDatabase } from '../../electron/shared/database'

const db = getDatabase()

const NOW = 1_700_000_000_000

function resetDb() {
  db.exec('DELETE FROM notes_fts')
  db.exec('DELETE FROM notes')
  db.exec('DELETE FROM messages_fts')
  db.exec('DELETE FROM messages')
  db.exec('DELETE FROM workspace_state')
  db.exec('DELETE FROM ai_conversation')
}

/** 建主会话 */
function makeMain(convId: string, title = '主会话') {
  createChatSession(convId, {
    title,
    createdAt: NOW,
    updatedAt: NOW,
    categoryId: null,
    scopeId: null,
    ord: 0,
  })
}

/** 建辅助会话 */
function makeAssistant(convId: string, scopeId: string, title = '辅助会话', ord = 0) {
  createChatSession(
    convId,
    { title, createdAt: NOW, updatedAt: NOW, categoryId: null, scopeId, ord },
    1
  )
}

beforeEach(() => {
  resetDb()
})

describe('FLOW-1 / FLOW-6 辅助会话归属', () => {
  it('只返回指定工作区的辅助会话', () => {
    makeMain('conv-m1')
    makeMain('conv-m2')
    makeAssistant('conv-a1', 'conv-m1')
    makeAssistant('conv-a2', 'conv-m2')

    expect(getAssistantChatSessions('conv-m1').map((s) => s.convId)).toEqual(['conv-a1'])
    expect(getAssistantChatSessions('conv-m2').map((s) => s.convId)).toEqual(['conv-a2'])
  })

  it('主会话不出现在任何工作区的辅助会话列表里', () => {
    makeMain('conv-m1')
    makeAssistant('conv-a1', 'conv-m1')

    const all = ['conv-m1', 'conv-m2'].flatMap((s) => getAssistantChatSessions(s).map((x) => x.convId))

    expect(all).toEqual(['conv-a1'])
  })

  it('辅助会话按 ord 升序返回', () => {
    makeMain('conv-m1')
    makeAssistant('conv-a1', 'conv-m1', '第一个', 0)
    makeAssistant('conv-a2', 'conv-m1', '第二个', 1)
    makeAssistant('conv-a3', 'conv-m1', '第三个', 2)

    expect(getAssistantChatSessions('conv-m1').map((s) => s.convId)).toEqual([
      'conv-a1',
      'conv-a2',
      'conv-a3',
    ])
  })

  it('updateConversationOrd 改变 Tab 顺序', () => {
    makeMain('conv-m1')
    makeAssistant('conv-a1', 'conv-m1', 'A', 0)
    makeAssistant('conv-a2', 'conv-m1', 'B', 1)

    updateConversationOrd('conv-a2', 0)
    updateConversationOrd('conv-a1', 1)

    expect(getAssistantChatSessions('conv-m1').map((s) => s.convId)).toEqual([
      'conv-a2',
      'conv-a1',
    ])
  })

  it('scopeId 为 null 的辅助会话不出现在任何工作区列表里', () => {
    makeAssistant('conv-orphan', '', '游离', 0)

    expect(getAssistantChatSessions('conv-m1')).toEqual([])
  })

  it('两个工作区的数据互不干扰', () => {
    makeMain('conv-m1')
    makeMain('conv-m2')
    makeAssistant('conv-a1', 'conv-m1')
    makeAssistant('conv-a2', 'conv-m2')

    expect(getAssistantChatSessions('conv-m1').map((s) => s.convId)).toEqual(['conv-a1'])
    expect(getAssistantChatSessions('conv-m2').map((s) => s.convId)).toEqual(['conv-a2'])
  })
})

describe('FLOW-1 / FLOW-2 消息与 FTS 同步', () => {
  it('消息按时间升序返回', () => {
    makeMain('conv-m1')
    makeAssistant('conv-a1', 'conv-m1')
    appendMessage('conv-a1', 'm2', 'assistant', '第二条', NOW + 100)
    appendMessage('conv-a1', 'm1', 'user', '第一条', NOW)

    expect(getMessagesByConvId('conv-a1').map((m) => m.content)).toEqual(['第一条', '第二条'])
  })

  it('appendMessage 后 messages_fts 能搜到该消息', () => {
    makeMain('conv-m1')
    makeAssistant('conv-a1', 'conv-m1')
    appendMessage('conv-a1', 'm1', 'user', '这里讨论了索引优化的方案', NOW)

    const hits = searchMessages('索引优化')

    expect(hits.map((h) => h.msgId)).toEqual(['m1'])
  })

  it('删除会话后 messages_fts 同步清除', () => {
    makeMain('conv-m1')
    makeAssistant('conv-a1', 'conv-m1')
    appendMessage('conv-a1', 'm1', 'user', '这里讨论了索引优化的方案', NOW)

    deleteConversationData('conv-a1')

    expect(searchMessages('索引优化')).toEqual([])
  })
})

describe('FLOW-3 / FLOW-4 笔记', () => {
  it('createNote 的 scopeId 正确落库', () => {
    makeMain('conv-m1')
    const note = createNote({ scopeId: 'conv-m1', content: '<p>x</p>' })

    const row = db.prepare('SELECT scopeId FROM notes WHERE id = ?').get(note.id)
    expect(row).toEqual({ scopeId: 'conv-m1' })
  })

  it('默认标题为「新笔记」', () => {
    const note = createNote({ scopeId: 'conv-m1' })
    expect(note.title).toBe('新笔记')
  })

  it('只返回该工作区的笔记', () => {
    createNote({ scopeId: 'conv-m1', title: 'A' })
    createNote({ scopeId: 'conv-m2', title: 'B' })

    expect(getNotesByScope('conv-m1').map((n) => n.title)).toEqual(['A'])
  })

  it('笔记按 ord 升序返回', () => {
    createNote({ scopeId: 'conv-m1', title: 'A' })
    createNote({ scopeId: 'conv-m1', title: 'B' })

    const notes = getNotesByScope('conv-m1')
    updateNoteOrd(notes[1].id, 0)
    updateNoteOrd(notes[0].id, 1)

    expect(getNotesByScope('conv-m1').map((n) => n.title)).toEqual(['B', 'A'])
  })

  it('updateNote 更新标题与正文', () => {
    const note = createNote({ scopeId: 'conv-m1', title: '旧标题', content: '<p>旧内容</p>' })

    const updated = updateNote(note.id, { title: '新标题', content: '<p>新内容</p>' })

    expect(updated.title).toBe('新标题')
    expect(updated.content).toBe('<p>新内容</p>')
    expect(getNote(note.id)?.content).toBe('<p>新内容</p>')
  })

  it('updateNote 内容超过 1MB 抛错且不落库', () => {
    const note = createNote({ scopeId: 'conv-m1', content: '<p>原内容</p>' })

    expect(() => updateNote(note.id, { content: 'x'.repeat(1024 * 1024 + 1) })).toThrow()
    expect(getNote(note.id)?.content).toBe('<p>原内容</p>')
  })

  it('createNote 内容超过 1MB 抛错', () => {
    expect(() => createNote({ scopeId: 'conv-m1', content: 'x'.repeat(1024 * 1024 + 1) })).toThrow()
  })

  it('删除笔记同时清掉 FTS 记录', () => {
    const note = createNote({ scopeId: 'conv-m1', content: '关于索引优化的结论' })

    deleteNote(note.id)

    expect(getNote(note.id)).toBeNull()
    expect(searchNotes('索引优化')).toEqual([])
  })

  it('更新笔记后 FTS 命中新内容、旧内容不再命中', () => {
    const note = createNote({ scopeId: 'conv-m1', content: '关于索引优化的结论' })

    updateNote(note.id, { content: '关于缓存失效的结论' })

    expect(searchNotes('索引优化')).toEqual([])
    expect(searchNotes('缓存失效').map((h) => h.noteId)).toEqual([note.id])
  })

  it('deleteNotesByScope 只删本工作区的笔记', () => {
    createNote({ scopeId: 'conv-m1', title: 'A' })
    createNote({ scopeId: 'conv-m2', title: 'B' })

    deleteNotesByScope('conv-m1')

    expect(getNotesByScope('conv-m1')).toEqual([])
    expect(getNotesByScope('conv-m2').map((n) => n.title)).toEqual(['B'])
  })
})

describe('FLOW-1 / FLOW-8 工作区状态', () => {
  it('未初始化的工作区返回空状态', () => {
    expect(getWorkspaceState('conv-m1')).toEqual({
      scopeId: 'conv-m1',
      activeConvId: null,
      activeNoteId: null,
    })
  })

  it('setWorkspaceActive 写入激活项后可读回', () => {
    setWorkspaceActive('conv-m1', { convId: 'conv-a1', noteId: 'note-1' })

    expect(getWorkspaceState('conv-m1')).toEqual({
      scopeId: 'conv-m1',
      activeConvId: 'conv-a1',
      activeNoteId: 'note-1',
    })
  })

  it('setWorkspaceActive 可单独置空某一项', () => {
    setWorkspaceActive('conv-m1', { convId: 'conv-a1', noteId: 'note-1' })

    setWorkspaceActive('conv-m1', { noteId: null })

    const state = getWorkspaceState('conv-m1')
    expect(state.activeConvId).toBe('conv-a1')
    expect(state.activeNoteId).toBeNull()
  })

  it('deleteWorkspaceState 清除该工作区状态', () => {
    setWorkspaceActive('conv-m1', { convId: 'conv-a1' })

    deleteWorkspaceState('conv-m1')

    expect(getWorkspaceState('conv-m1').activeConvId).toBeNull()
  })
})

describe('FLOW-7 搜索', () => {
  beforeEach(() => {
    makeMain('conv-m1', '性能优化')
    makeMain('conv-m2', '缓存设计')
    makeAssistant('conv-a1', 'conv-m1', '辅助A')
    createNote({ scopeId: 'conv-m1', title: '索引结论', content: '关于索引优化的结论' })
  })

  it('中文关键词命中笔记，snippet 为原文片段', () => {
    const hits = searchNotes('索引优化')

    expect(hits).toHaveLength(1)
    expect(hits[0].title).toBe('索引结论')
    expect(hits[0].snippet).toContain('索引优化')
  })

  it('搜索结果标注来源主会话标题', () => {
    expect(searchNotes('索引优化')[0].scopeTitle).toBe('性能优化')
  })

  it('搜索命中消息时返回会话标题与工作区标题', () => {
    appendMessage('conv-a1', 'm1', 'user', '这里讨论了索引优化的方案', NOW)

    const hits = searchMessages('索引优化')

    expect(hits).toHaveLength(1)
    expect(hits[0].convId).toBe('conv-a1')
    expect(hits[0].convTitle).toBe('辅助A')
    expect(hits[0].scopeId).toBe('conv-m1')
    expect(hits[0].scopeTitle).toBe('性能优化')
  })

  it('1-2 字符关键词走 LIKE 回退仍能命中', () => {
    const hits = searchNotes('索引')

    expect(hits).toHaveLength(1)
    expect(hits[0].noteId).toBeTruthy()
  })

  it('搜索跨全部工作区', () => {
    createNote({ scopeId: 'conv-m2', title: '缓存笔记', content: '索引缓存的另一种做法' })

    const hits = searchNotes('索引')

    expect(hits.map((h) => h.scopeTitle).sort()).toEqual(['性能优化', '缓存设计'])
  })

  it('含 FTS 特殊字符的关键词不抛错', () => {
    expect(() => searchNotes('索引"优化')).not.toThrow()
    expect(() => searchNotes('a OR b')).not.toThrow()
    expect(() => searchNotes('')).not.toThrow()
  })
})

describe('安全：参数化查询', () => {
  it('恶意 scopeId 不破坏表结构', () => {
    const malicious = "x'; DROP TABLE notes; --"

    expect(() => getNotesByScope(malicious)).not.toThrow()
    expect(() => getAssistantChatSessions(malicious)).not.toThrow()

    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
      .get()
    expect(tableExists).toBeTruthy()
  })

  it('恶意 noteId 不破坏表结构', () => {
    const malicious = "x'; DROP TABLE notes_fts; --"

    expect(() => getNote(malicious)).not.toThrow()
    expect(() => deleteNote(malicious)).not.toThrow()

    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'")
      .get()
    expect(tableExists).toBeTruthy()
  })
})
