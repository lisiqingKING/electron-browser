import { ipcMain } from 'electron'
import { workspaceChannels } from './ipcClient'
import { getWorkspaceState, setWorkspaceActive, deleteWorkspaceState } from './workspaceDb'
import { getConversationOwnership } from '../ai/aiConversationDb'
import { isValidId } from '../../shared/ids'

/**
 * IPC 边界校验：scopeId 必须是一个已存在的主会话。
 * 否则会写出永远打不开的工作区状态行。
 */
function isMainConversation(scopeId: string): boolean {
  const ownership = getConversationOwnership(scopeId)
  return !!ownership && !ownership.isAssistant
}

export function registerWorkspaceHandlers() {
  ipcMain.handle(workspaceChannels.getState, async (_event, scopeId: string) => {
    if (!isValidId(scopeId)) return { scopeId, activeConvId: null, activeNoteId: null }
    return getWorkspaceState(scopeId)
  })

  ipcMain.handle(
    workspaceChannels.setActive,
    async (_event, scopeId: string, patch: { convId?: string | null; noteId?: string | null }) => {
      if (!isValidId(scopeId) || !isMainConversation(scopeId)) {
        return { scopeId, activeConvId: null, activeNoteId: null }
      }
      const next = patch ?? {}
      if (next.convId !== undefined && next.convId !== null && !isValidId(next.convId)) {
        return getWorkspaceState(scopeId)
      }
      if (next.noteId !== undefined && next.noteId !== null && !isValidId(next.noteId)) {
        return getWorkspaceState(scopeId)
      }
      return setWorkspaceActive(scopeId, next)
    }
  )

  ipcMain.handle(workspaceChannels.deleteState, async (_event, scopeId: string) => {
    if (!isValidId(scopeId)) return false
    deleteWorkspaceState(scopeId)
    return true
  })
}
