import path from 'node:path'
import fs from 'node:fs'
import { ipcMain, dialog } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { getDownloadManager, downloadsChannels, getDownloadSaveDir } from './manager'
import type { AddHttpInput } from './downloadTypes'
import { getSetting } from '../settings/manager'

function deriveFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (last) return decodeURIComponent(last)
  } catch {
    // ignore
  }
  return 'download'
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

export function registerDownloadHandlers(): void {
  const manager = getDownloadManager()

  ipcMain.handle(downloadsChannels.list, () => manager.list().map((t) => t.toJSON()))

  ipcMain.handle(downloadsChannels.add, async (_event, input: AddHttpInput) => {
    if (!input || typeof input.url !== 'string' || input.url.length === 0) {
      ipcLogger.error(`downloads:add invalid input: ${JSON.stringify(input)}`)
      throw new Error('invalid url')
    }

    let saveDir = getDownloadSaveDir()
    let filename = input.filename?.trim() || deriveFilenameFromUrl(input.url)

    if (getSetting('download_ask_save_dir') === 'true') {
      const result = await dialog.showSaveDialog({
        title: '选择保存位置',
        defaultPath: path.join(saveDir, filename),
        filters: [{ name: '所有文件', extensions: ['*'] }],
      })
      if (result.canceled || !result.filePath) {
        throw new Error('canceled')
      }
      saveDir = path.dirname(normalizePath(result.filePath))
      filename = path.basename(normalizePath(result.filePath))
    }

    return (manager.addHttpTask as any)({ ...input, saveDir, filename }).toJSON()
  })

  ipcMain.handle(downloadsChannels.pause, (_event, id: string) => manager.pause(id))

  ipcMain.handle(downloadsChannels.resume, (_event, id: string) => manager.resume(id))

  ipcMain.handle(downloadsChannels.cancel, async (_event, id: string) => {
    await manager.cancel(id)
    return true
  })

  ipcMain.handle(downloadsChannels.remove, async (_event, id: string) => {
    await manager.remove(id)
    return true
  })

  ipcMain.handle(downloadsChannels.reveal, (_event, id: string) => manager.reveal(id))

  ipcMain.handle(downloadsChannels.openFile, (_event, id: string) => manager.openFile(id))

  ipcMain.handle(downloadsChannels.clear, async () => manager.clearAll())

  // blob/data URL 下载：渲染进程 fetch 后通过此 IPC 写入文件并加入下载记录
  // 路径 A：直接用真实 URL 创建 HTTP 下载任务（可复用完整下载能力）
  ipcMain.handle(downloadsChannels.directDownloadUrl, async (_event, input: { url: string; filename?: string }) => {
    const { url, filename } = input
    if (!url || typeof url !== 'string') {
      ipcLogger.error('[direct-download-url] invalid url:', url)
      throw new Error('invalid url')
    }
    const saveDir = getDownloadSaveDir()
    const desired = filename || deriveFilenameFromUrl(url)

    let finalFilename = desired
    let finalSaveDir = saveDir

    if (getSetting('download_ask_save_dir') === 'true') {
      const result = await dialog.showSaveDialog({
        title: '选择保存位置',
        defaultPath: path.join(saveDir, desired),
        filters: [{ name: '所有文件', extensions: ['*'] }],
      })
      if (result.canceled || !result.filePath) {
        throw new Error('canceled')
      }
      finalSaveDir = path.dirname(normalizePath(result.filePath))
      finalFilename = path.basename(normalizePath(result.filePath))
    } else {
      // 生成唯一文件名
      const ext = path.extname(finalFilename)
      const base = ext ? finalFilename.slice(0, -ext.length) : finalFilename
      let candidate = finalFilename
      let counter = 1
      while (fs.existsSync(path.join(finalSaveDir, candidate))) {
        candidate = `${base} (${counter})${ext}`
        counter++
      }
      finalFilename = candidate
    }

    return (manager.addHttpTask as any)({
      url,
      filename: finalFilename,
      saveDir: finalSaveDir,
      method: 'GET',
      headers: {},
      referrer: null,
      mimeType: null,
    }).toJSON()
  })
}
