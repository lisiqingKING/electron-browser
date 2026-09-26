import { ipcMain, app, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { cloneDeep } from 'lodash'
import { ipcLogger } from '../../shared/logger'
import { aiChannels } from './ipcClient'
import {
  getAllChatSessions,
  getChatSessionsPage,
  createChatSession,
  updateTitle,
  deleteChatSession,
  updatePinned,
} from './manager'
import { getSetting, setSetting } from '../settings/manager'
import { startStreaming, abortStream } from './streamingChatHandler'
import { touchConversation, getAllSystemPrompts, createSystemPrompt, updateSystemPrompt, deleteSystemPrompt } from './aiDb'
import { getMessagesByConvId, appendMessage } from './aiConversationDb'

export function registerAIHandlers() {
  ipcMain.handle(aiChannels.list, async (_event, options?: { limit?: number; offset?: number }) => {
    if (options?.limit !== undefined) {
      return getChatSessionsPage(options.limit, options.offset ?? 0)
    }
    return getAllChatSessions()
  })

  ipcMain.handle(aiChannels.create, async (_event, title?: string) => {
    return createChatSession(title)
  })

  ipcMain.handle(aiChannels.updateTitle, async (_event, convId: string, title: string) => {
    updateTitle(convId, title)
    return true
  })

  ipcMain.handle(aiChannels.getMessages, async (_event, convId: string) => {
    return getMessagesByConvId(convId)
  })

  ipcMain.handle(aiChannels.delete, async (_event, convId: string) => {
    deleteChatSession(convId)
    return true
  })

  ipcMain.handle(aiChannels.updatePinned, async (_event, convId: string, pinned: number) => {
    updatePinned(convId, pinned)
    return true
  })

  ipcMain.handle(aiChannels.getModel, async () => {
    return getSetting('ai_model') || 'mimo-v2.5-pro'
  })

  // ============ AI Profile 多配置管理 ============

  function parseProfiles(): Array<{
    name: string
    providerType: string
    apiKey: string
    apiUrl: string
    model: string
    systemPromptIds: string[]
  }> {
    const raw = getSetting('ai_profiles')
    if (!raw) return []
    try { return JSON.parse(raw) } catch { return [] }
  }

  function saveProfiles(profiles: any[]) {
    setSetting('ai_profiles', JSON.stringify(profiles))
  }

  ipcMain.handle(aiChannels.getActiveProfile, async () => {
    const activeName = getSetting('ai_active_profile')
    const profiles = parseProfiles()
    const active = profiles.find(p => p.name === activeName)
    if (active) return active
    if (profiles.length > 0) return profiles[0]
    return null
  })

  ipcMain.handle(aiChannels.listProfiles, async () => {
    return parseProfiles()
  })

  ipcMain.handle(aiChannels.saveProfile, async (_event, profile: {
    name: string
    providerType: string
    apiKey: string
    apiUrl: string
    model: string
    systemPromptIds?: string[]
  }) => {
    const profiles = parseProfiles()
    const idx = profiles.findIndex(p => p.name === profile.name)
    const toSave = {
      ...profile,
      systemPromptIds: profile.systemPromptIds ?? []
    }
    if (idx >= 0) {
      profiles[idx] = toSave
    } else {
      profiles.push(toSave)
    }
    saveProfiles(profiles)
    return true
  })

  ipcMain.handle(aiChannels.setActiveProfile, async (_event, name: string) => {
    const profiles = parseProfiles()
    if (!profiles.find(p => p.name === name)) {
      throw new Error(`配置 "${name}" 不存在`)
    }
    setSetting('ai_active_profile', name)
    return true
  })

  ipcMain.handle(aiChannels.deleteProfile, async (_event, name: string) => {
    let profiles = parseProfiles()
    profiles = profiles.filter(p => p.name !== name)
    saveProfiles(profiles)
    // 如果删除的是激活配置，清除激活标记
    if (getSetting('ai_active_profile') === name) {
      setSetting('ai_active_profile', profiles[0]?.name || '')
    }
    return true
  })

  // ============ System Prompt CRUD ============

  ipcMain.handle(aiChannels.listSystemPrompts, async () => {
    return getAllSystemPrompts()
  })

  ipcMain.handle(aiChannels.saveSystemPrompt, async (_event, prompt: { id?: string; name: string; content: string }) => {
    const now = Date.now()
    if (prompt.id) {
      updateSystemPrompt(prompt.id, prompt.name, prompt.content)
    } else {
      const id = `sp-${now}-${crypto.randomUUID().slice(0, 8)}`
      createSystemPrompt(id, prompt.name, prompt.content, now)
    }
    return true
  })

  ipcMain.handle(aiChannels.deleteSystemPrompt, async (_event, id: string) => {
    const profiles = parseProfiles()
    const usedBy = profiles.filter(p => p.systemPromptIds?.includes(id))
    if (usedBy.length > 0) {
      throw new Error(`该提示词正被以下配置使用：${usedBy.map(p => p.name).join('、')}`)
    }
    deleteSystemPrompt(id)
    return true
  })

  ipcMain.handle(aiChannels.getSystemPromptsByIds, async (_event, ids: string[]) => {
    const all = getAllSystemPrompts()
    return all.filter(p => ids.includes(p.id))
  })

  // 流式聊天
  ipcMain.handle(aiChannels.chat, async (event, options: {
    conversationId: string
    messageId: string
    apiUrl: string
    apiKey?: string
    providerType: string
    model: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  }) => {
    const windowId = event.sender.id
    const now = Date.now()

    // 先确保 conversation 存在
    touchConversation(options.conversationId, now)

    // 提取并持久化用户消息
    const lastUserMsg = [...options.messages].reverse().find(m => m.role === 'user')
    if (lastUserMsg) {
      const userMsgId = `msg-${now}-${crypto.randomUUID().slice(0, 8)}`
      appendMessage(options.conversationId, userMsgId, 'user', lastUserMsg.content, now)
    }

    // 启动流式响应（深拷贝防止下游污染原始引用）
    startStreaming({
      conversationId: options.conversationId,
      messageId: options.messageId,
      apiUrl: options.apiUrl,
      apiKey: options.apiKey,
      providerType: options.providerType,
      model: options.model,
      messages: cloneDeep(options.messages),
      targetWindowId: windowId,
    })

    // 返回使用的 assistant 消息 ID
    return { messageId: options.messageId }
  })

  ipcMain.handle(aiChannels.abort, async (_, messageId: string) => {
    return abortStream(messageId)
  })

  ipcMain.handle(aiChannels.saveFile, async (_event, content: string, filename: string) => {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      ipcLogger.error(`ai:saveFile invalid filename: ${filename}`)
      throw new Error('非法文件名')
    }
    const saveDir = app.getPath('downloads')
    const filePath = path.join(saveDir, filename)
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8')
      return filePath
    } catch (err) {
      ipcLogger.error(`ai:saveFile failed: ${err}`)
      throw err
    }
  })

  ipcMain.handle(aiChannels.openSaveDir, async () => {
    const saveDir = app.getPath('downloads')
    await shell.openPath(saveDir)
    return true
  })

  ipcMain.handle(aiChannels.listSaveFiles, async () => {
    const saveDir = app.getPath('downloads')
    try {
      const files = await fs.promises.readdir(saveDir)
      const mdFiles = files.filter(f => f.endsWith('.md'))
      const fileInfos = await Promise.all(
        mdFiles.map(async (filename) => {
          const filePath = path.join(saveDir, filename)
          const stat = await fs.promises.stat(filePath)
          return { filename, createdAt: stat.birthtimeMs, size: stat.size }
        })
      )
      return fileInfos.sort((a, b) => b.createdAt - a.createdAt)
    } catch {
      return []
    }
  })

  ipcMain.handle(aiChannels.readSaveFile, async (_event, filename: string) => {
    if (!filename || path.basename(filename) !== filename) {
      ipcLogger.error(`ai:readSaveFile invalid filename: ${filename}`)
      throw new Error('非法文件名')
    }
    const saveDir = app.getPath('downloads')
    const filePath = path.join(saveDir, filename)
    try {
      return await fs.promises.readFile(filePath, 'utf-8')
    } catch (err) {
      ipcLogger.error(`ai:readSaveFile failed: ${err}`)
      return null
    }
  })

  ipcMain.handle(aiChannels.deleteSaveFile, async (_event, filename: string) => {
    if (!filename || path.basename(filename) !== filename) {
      ipcLogger.error(`ai:deleteSaveFile invalid filename: ${filename}`)
      throw new Error('非法文件名')
    }
    const saveDir = app.getPath('downloads')
    const filePath = path.join(saveDir, filename)
    try {
      await fs.promises.unlink(filePath)
      return true
    } catch (err) {
      ipcLogger.error(`ai:deleteSaveFile failed: ${err}`)
      return false
    }
  })
}
