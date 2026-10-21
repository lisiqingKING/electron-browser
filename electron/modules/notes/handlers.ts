import { ipcMain } from 'electron'
import { notesChannels } from './ipcClient'
import {
  createNote,
  getNote,
  getNotesByScope,
  updateNote,
  deleteNote,
  updateNoteOrd,
  type CreateNoteInput,
} from './notesDb'
import { clearActiveNoteIfDeleted } from '../workspace/workspaceDb'
import { getConversationOwnership } from '../ai/aiConversationDb'
import { isValidId } from '../../shared/ids'

/**
 * IPC 边界校验：scopeId 必须是一个已存在的主会话。
 * 否则笔记会挂在一个打不开的工作区上，成为永远不可见的孤儿数据。
 */
function isMainConversation(scopeId: string): boolean {
  const ownership = getConversationOwnership(scopeId)
  return !!ownership && !ownership.isAssistant
}

export function registerNotesHandlers() {
  ipcMain.handle(notesChannels.create, async (_event, input: CreateNoteInput) => {
    if (!input || !isValidId(input.scopeId) || !isMainConversation(input.scopeId)) {
      throw new Error('笔记所属会话不存在')
    }
    return createNote(input)
  })

  ipcMain.handle(notesChannels.list, async (_event, scopeId: string) => {
    if (!isValidId(scopeId)) return []
    return getNotesByScope(scopeId)
  })

  ipcMain.handle(notesChannels.get, async (_event, noteId: string) => {
    if (!isValidId(noteId)) return null
    return getNote(noteId)
  })

  ipcMain.handle(
    notesChannels.update,
    async (_event, noteId: string, patch: { title?: string; content?: string }) => {
      if (!isValidId(noteId)) throw new Error('笔记 ID 非法')
      return updateNote(noteId, patch)
    }
  )

  ipcMain.handle(notesChannels.delete, async (_event, noteId: string) => {
    if (!isValidId(noteId) || !getNote(noteId)) return false
    deleteNote(noteId)
    clearActiveNoteIfDeleted(noteId)
    return true
  })

  ipcMain.handle(
    notesChannels.reorder,
    async (_event, scopeId: string, orderedNoteIds: string[]) => {
      if (!Array.isArray(orderedNoteIds)) return false
      // 只调整属于该工作区的笔记，避免误改其他工作区的顺序
      const inScope = new Set(getNotesByScope(scopeId).map((n) => n.id))
      orderedNoteIds.forEach((noteId, index) => {
        if (inScope.has(noteId)) updateNoteOrd(noteId, index)
      })
      return true
    }
  )
}
