import fs from 'node:fs'
import path from 'node:path'
import { app, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import * as downloadDb from '../downloadDb'
import { DownloadTaskStore } from './taskStore'
import { DownloadNotifier } from './notifier'
import { DownloadScheduler } from './scheduler'
import { DownloadTask } from './task'
import type { AddHttpInput } from '../downloadTypes'
import { downloadsChannels } from '../channels'
import { getSetting as getSettingsValue } from '../../settings/manager'

export { downloadsChannels }
export { getDownloadSaveDir }

function getDownloadSaveDir(): string {
  const saved = getSettingsValue('download_save_dir')
  return saved || app.getPath('downloads')
}

export class DownloadManager {
  private readonly store: DownloadTaskStore
  private readonly notifier: DownloadNotifier
  private readonly scheduler: DownloadScheduler

  constructor() {
    this.store = new DownloadTaskStore()
    this.notifier = new DownloadNotifier(this.store)
    this.scheduler = new DownloadScheduler(this.store, this.notifier)
  }

  init(): void {
    this.store.init()
  }

  list(): DownloadTask[] {
    return this.store.list()
  }

  get(id: string): DownloadTask | null {
    return this.store.get(id)
  }

  has(id: string): boolean {
    return this.store.has(id)
  }

  addHttpTask(input: AddHttpInput): DownloadTask {
    const saveDir = (input as any).saveDir || getDownloadSaveDir()
    const desired = input.filename?.trim() || this.deriveFilenameFromUrl(input.url)
    const filename = this.uniqueFilename(saveDir, desired)
    const task = DownloadTask.createHttp(input, saveDir, filename)
    this.store.add(task)
    this.notifier.emitAdded(task)
    this.scheduler.pump()
    return task
  }

  // blob/data URL 下载：文件已写入磁盘，直接作为已完成任务加入记录
  async addBlobTask(opts: {
    savePath: string
    filename: string
    mimeType: string | null
    referrer: string | null
    url: string
  }): Promise<DownloadTask> {
    const { savePath, filename, mimeType, referrer, url } = opts
    const stat = await fs.promises.stat(savePath)
    const now = Date.now()
    const task = DownloadTask.fromRow({
      id: randomUUID(),
      url,
      method: 'GET',
      postBody: null,
      headers: {},
      filename,
      saveDir: path.dirname(savePath),
      totalBytes: stat.size,
      receivedBytes: stat.size,
      status: 'completed',
      error: null,
      referrer,
      mimeType,
      createdAt: now,
      updatedAt: now,
    })
    this.store.add(task)
    this.notifier.completeTask(task)
    return task
  }

  pause(id: string): boolean {
    const task = this.store.get(id)
    if (!task || !task.canPause()) return false
    return this.scheduler.pause(id)
  }

  resume(id: string): boolean {
    const task = this.store.get(id)
    console.log('[manager] resume called, id:', id, 'task:', task?.id, 'status:', task?.status)
    if (!task || !task.canResume()) return false
    task.setStatus('queued')
    this.notifier.emitProgress(task)
    this.scheduler.pump()
    return true
  }

  async cancel(id: string): Promise<boolean> {
    const task = this.store.get(id)
    if (!task || !task.canCancel()) return false

    if (this.scheduler.cancel(id)) return true

    task.setStatus('canceled')
    this.notifier.finishTask(task)
    return true
  }

  async remove(id: string): Promise<boolean> {
    const task = this.store.get(id)
    if (!task) return false

    this.store.delete(id)
    this.scheduler.cancel(id)
    this.notifier.clearTimer(id)

    try {
      await fs.promises.unlink(path.join(task.saveDir, task.filename))
    } catch (e: any) {
      if (e.code && e.code !== 'ENOENT') {
        // best-effort delete
      }
    }

    this.notifier.emitRemoved(id)
    return true
  }

  reveal(id: string): string | null {
    const task = this.store.get(id)
    if (!task) return null
    const full = path.join(task.saveDir, task.filename)
    shell.showItemInFolder(full)
    return full
  }

  openFile(id: string): Promise<string | null> {
    const task = this.store.get(id)
    if (!task) return Promise.resolve(null)
    const full = path.join(task.saveDir, task.filename)
    return shell.openPath(full)
  }

  async clearAll(): Promise<number> {
    const tasks = [...this.store.list()]
    for (const t of tasks) {
      this.scheduler.cancel(t.id)
      this.notifier.clearTimer(t.id)
    }
    for (const t of tasks) {
      try {
        await fs.promises.unlink(path.join(t.saveDir, t.filename))
      } catch (e: any) {
        if (!e.code || e.code !== 'ENOENT') {
          // best-effort
        }
      }
    }
    downloadDb.deleteAllDownloads()
    this.store.clear()
    for (const t of tasks) {
      this.notifier.emitRemoved(t.id)
    }
    return tasks.length
  }

  async shutdown(): Promise<void> {
    this.scheduler.shutdown()
    this.notifier.shutdown()
  }

  private uniqueFilename(saveDir: string, desired: string): string {
    const ext = path.extname(desired)
    const base = ext ? desired.slice(0, -ext.length) : desired
    let candidate = desired
    let counter = 1
    while (fs.existsSync(path.join(saveDir, candidate))) {
      candidate = `${base} (${counter})${ext}`
      counter++
    }
    return candidate
  }

  private deriveFilenameFromUrl(url: string): string {
    try {
      const u = new URL(url)
      const last = u.pathname.split('/').filter(Boolean).pop()
      if (last) return decodeURIComponent(last)
    } catch {
      // ignore
    }
    return 'download'
  }
}

let instance: DownloadManager | null = null

export function getDownloadManager(): DownloadManager {
  if (!instance) {
    instance = new DownloadManager()
  }
  return instance
}
