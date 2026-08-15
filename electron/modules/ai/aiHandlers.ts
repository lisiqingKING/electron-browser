import { ipcMain, app, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  getAllChatSessions,
  getChatSessionsPage,
  createChatSession,
  updateTitle,
  updateMessages,
  deleteChatSession,
  updatePinned,
} from './manager'
import { getSetting } from '../settings/manager'

export function registerAIHandlers() {
  ipcMain.handle('ai:list', async (_event, options?: { limit?: number; offset?: number }) => {
    if (options?.limit !== undefined) {
      return getChatSessionsPage(options.limit, options.offset ?? 0)
    }
    return getAllChatSessions()
  })

  ipcMain.handle('ai:create', async (_event, title?: string) => {
    return createChatSession(title)
  })

  ipcMain.handle('ai:updateTitle', async (_event, convId: string, title: string) => {
    updateTitle(convId, title)
    return true
  })

  ipcMain.handle('ai:updateMessages', async (_event, convId: string, messages: any[]) => {
    updateMessages(convId, messages)
    return true
  })

  ipcMain.handle('ai:delete', async (_event, convId: string) => {
    deleteChatSession(convId)
    return true
  })

  ipcMain.handle('ai:updatePinned', async (_event, convId: string, pinned: number) => {
    updatePinned(convId, pinned)
    return true
  })

  ipcMain.handle('ai:getModel', async () => {
    return getSetting('ai_model') || 'mimo-v2.5-pro'
  })

  ipcMain.handle('ai:saveFile', async (_event, content: string, filename: string) => {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('非法文件名')
    }
    const saveDir = app.getPath('downloads')
    const filePath = path.join(saveDir, filename)
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return filePath
  })

  ipcMain.handle('ai:openSaveDir', async () => {
    const saveDir = app.getPath('downloads')
    await shell.openPath(saveDir)
    return true
  })

  ipcMain.handle('ai:listSaveFiles', async () => {
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

  ipcMain.handle('ai:readSaveFile', async (_event, filename: string) => {
    if (!filename || path.basename(filename) !== filename) {
      throw new Error('非法文件名')
    }
    const saveDir = app.getPath('downloads')
    const filePath = path.join(saveDir, filename)
    try {
      return await fs.promises.readFile(filePath, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('ai:deleteSaveFile', async (_event, filename: string) => {
    if (!filename || path.basename(filename) !== filename) {
      throw new Error('非法文件名')
    }
    const saveDir = app.getPath('downloads')
    const filePath = path.join(saveDir, filename)
    try {
      await fs.promises.unlink(filePath)
      return true
    } catch {
      return false
    }
  })
}
