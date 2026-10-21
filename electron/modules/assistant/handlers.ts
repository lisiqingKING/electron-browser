import { ipcMain } from 'electron'
import { assistantChannels } from './ipcClient'
import {
  createAssistantChatSession,
  getAssistantChatSessions,
  updateTitle,
  deleteAssistantChatSession,
} from '../ai/manager'
import {
  getMessagesByConvId,
  updateConversationOrd,
  getConversationOwnership,
} from '../ai/aiConversationDb'
import { setWorkspaceActive } from '../workspace/workspaceDb'
import { isValidId } from '../../shared/ids'

/**
 * IPC 边界校验：scopeId 必须是一个已存在的主会话。
 * 工作区就是主会话，作用域不存在时创建出来的辅助会话 / 笔记永远打不开。
 */
function isMainConversation(scopeId: string): boolean {
  const ownership = getConversationOwnership(scopeId)
  return !!ownership && !ownership.isAssistant
}

/** IPC 边界校验：convId 必须是辅助会话。主会话要走带工作区级联的删除路径。 */
function isAssistantConversation(convId: string): boolean {
  const ownership = getConversationOwnership(convId)
  return !!ownership && !!ownership.isAssistant
}

export function registerAssistantHandlers() {
  // 在指定工作区新建辅助会话，并设为该工作区的当前激活项
  ipcMain.handle(assistantChannels.create, async (_event, scopeId: string) => {
    if (!isValidId(scopeId) || !isMainConversation(scopeId)) return null
    const session = createAssistantChatSession(scopeId)
    setWorkspaceActive(scopeId, { convId: session.convId })
    return { convId: session.convId }
  })

  ipcMain.handle(assistantChannels.list, async (_event, scopeId: string) => {
    if (!isValidId(scopeId)) return []
    return getAssistantChatSessions(scopeId)
  })

  ipcMain.handle(assistantChannels.getMessages, async (_event, convId: string) => {
    if (!isValidId(convId) || !isAssistantConversation(convId)) return []
    return getMessagesByConvId(convId)
  })

  ipcMain.handle(assistantChannels.rename, async (_event, convId: string, title: string) => {
    if (!isValidId(convId) || !isAssistantConversation(convId)) return false
    updateTitle(convId, title)
    return true
  })

  // 级联删除：消息 → 全文索引 → 会话记录 → 置空激活项。
  // 笔记归工作区所有，不随辅助会话删除。
  ipcMain.handle(assistantChannels.deleteSession, async (_event, convId: string) => {
    if (!isValidId(convId) || !isAssistantConversation(convId)) return false
    deleteAssistantChatSession(convId)
    return true
  })

  ipcMain.handle(
    assistantChannels.reorder,
    async (_event, scopeId: string, orderedConvIds: string[]) => {
      if (!Array.isArray(orderedConvIds)) return false
      // 只调整属于该工作区的会话，避免误改其他工作区的顺序
      const inScope = new Set(getAssistantChatSessions(scopeId).map((s) => s.convId))
      orderedConvIds.forEach((convId, index) => {
        if (inScope.has(convId)) updateConversationOrd(convId, index)
      })
      return true
    }
  )
}
