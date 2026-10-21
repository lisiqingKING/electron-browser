import { getDatabase } from '../../shared/database'
import { deleteNotesByScope } from '../notes/notesDb'

// ============ 表初始化 ============
// 归属：workspace_state（工作区状态）由本模块拥有。
// 工作区 = 一个主会话对应的辅助面板内容集合，scopeId 即主会话 convId。

const db = getDatabase()

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_state (
    scopeId      TEXT PRIMARY KEY,
    activeConvId TEXT,
    activeNoteId TEXT
  )
`)

// ============ 类型 ============

export interface WorkspaceState {
  scopeId: string
  activeConvId: string | null
  activeNoteId: string | null
}

// ============ 读写 ============

// 读取工作区状态（不存在返回空状态）
export function getWorkspaceState(scopeId: string): WorkspaceState {
  const row = getDatabase()
    .prepare('SELECT scopeId, activeConvId, activeNoteId FROM workspace_state WHERE scopeId = ?')
    .get(scopeId) as WorkspaceState | undefined
  return row ?? { scopeId, activeConvId: null, activeNoteId: null }
}

// 设置激活项（未传的字段保持原值，传 null 表示置空）
export function setWorkspaceActive(
  scopeId: string,
  patch: { convId?: string | null; noteId?: string | null }
): WorkspaceState {
  const current = getWorkspaceState(scopeId)
  const activeConvId = patch.convId !== undefined ? patch.convId : current.activeConvId
  const activeNoteId = patch.noteId !== undefined ? patch.noteId : current.activeNoteId

  getDatabase()
    .prepare(
      `INSERT INTO workspace_state (scopeId, activeConvId, activeNoteId) VALUES (?, ?, ?)
       ON CONFLICT(scopeId) DO UPDATE SET activeConvId = excluded.activeConvId, activeNoteId = excluded.activeNoteId`
    )
    .run(scopeId, activeConvId, activeNoteId)

  return { scopeId, activeConvId, activeNoteId }
}

// 删除工作区状态
export function deleteWorkspaceState(scopeId: string): void {
  getDatabase().prepare('DELETE FROM workspace_state WHERE scopeId = ?').run(scopeId)
}

// 删除整个工作区：笔记 + 工作区状态
export function deleteWorkspaceByScope(scopeId: string): void {
  deleteNotesByScope(scopeId)
  deleteWorkspaceState(scopeId)
}

// ============ 悬空引用清理 ============

// 辅助会话被删除后，置空指向它的激活项
export function clearActiveConvIfDeleted(convId: string): void {
  getDatabase()
    .prepare('UPDATE workspace_state SET activeConvId = NULL WHERE activeConvId = ?')
    .run(convId)
}

// 笔记被删除后，置空指向它的激活项
export function clearActiveNoteIfDeleted(noteId: string): void {
  getDatabase()
    .prepare('UPDATE workspace_state SET activeNoteId = NULL WHERE activeNoteId = ?')
    .run(noteId)
}
