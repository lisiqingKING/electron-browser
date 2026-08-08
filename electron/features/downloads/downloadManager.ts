import fs from 'node:fs'
import path from 'node:path'
import { app, shell } from 'electron'
import * as downloadDb from './downloadDb'
import { DownloadTaskStore } from './internal/downloadTaskStore'
import { DownloadNotifier } from './internal/downloadNotifier'
import { DownloadScheduler } from './internal/downloadScheduler'
import { DownloadTask } from './internal/downloadTask'
import type { AddHttpInput } from './downloadTypes'
import { downloadsChannels } from './channels'

export { downloadsChannels }

// Facade over store / notifier / scheduler. 公共 API 都在这里.
// 编排规则: 改 task 字段 → task.setStatus / setProgress; 持久化 → store.add / delete; 推事件 → notifier; 启动/取消 I/O → scheduler.
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
    const saveDir = app.getPath('downloads')
    const desired = input.filename?.trim() || this.deriveFilenameFromUrl(input.url)
    const filename = this.uniqueFilename(saveDir, desired)
    const task = DownloadTask.createHttp(input, saveDir, filename)
    this.store.add(task)
    this.notifier.emitAdded(task)
    this.scheduler.pump()
    return task
  }

  pause(id: string): boolean {
    const task = this.store.get(id)
    if (!task || !task.canPause()) return false
    return this.scheduler.pause(id)
  }

  resume(id: string): boolean {
    const task = this.store.get(id)
    if (!task || !task.canResume()) return false
    task.setStatus('queued')
    this.notifier.emitProgress(task)
    this.scheduler.pump()
    return true
  }

  async cancel(id: string): Promise<boolean> {
    const task = this.store.get(id)
    if (!task || !task.canCancel()) return false

    // in-flight (downloading): abort 走 scheduler, catch 块里 setStatus('canceled') + finishTask
    if (this.scheduler.cancel(id)) return true

    // queued / paused: 没有 AbortController, scheduler.cancel 返回 false
    // 直接改 status, 推一次 progress 事件让 UI 更新按钮组
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

  // 清空所有: 取消 in-flight + 删全部文件 + DB 全删 + store 清空 + 推 removed.
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
      counter += 1
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
