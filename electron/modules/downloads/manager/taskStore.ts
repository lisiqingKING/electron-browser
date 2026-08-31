import * as downloadDb from '../downloadDb'
import { DownloadTask } from './task'

// 纯内存任务列表 wrapper. 只管 list-level 操作 (init/add/delete/get/has/list/clear/pickNextRunnable).
// 单个任务的 status/progress 变更走 task.setStatus / setProgress, task 自己写回 DB——store 不掺和.
export class DownloadTaskStore {
  private tasks: Map<string, DownloadTask> = new Map()
  private initialized = false

  init(): void {
    if (this.initialized) return
    this.initialized = true
    const rows = downloadDb.getAllDownloads()
    for (const task of rows) {
      this.tasks.set(task.id, task)
    }
  }

  list(): DownloadTask[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  get(id: string): DownloadTask | null {
    return this.tasks.get(id) ?? null
  }

  has(id: string): boolean {
    return this.tasks.has(id)
  }

  add(task: DownloadTask): void {
    this.tasks.set(task.id, task)
    downloadDb.insertDownload(task)
  }

  delete(id: string): void {
    this.tasks.delete(id)
    downloadDb.deleteDownloadById(id)
  }

  clear(): void {
    this.tasks.clear()
  }

  // 给调度器用: 选下一个可启动的 (queued 状态, FIFO).
  // 暂停后用户点"继续" 会先 setStatus('queued') 再调 pump(), 走的是同一条路径.
  pickNextRunnable(): DownloadTask | null {
    let oldest: DownloadTask | null = null
    for (const t of this.tasks.values()) {
      if (t.status !== 'queued') continue
      if (!oldest || t.createdAt < oldest.createdAt) oldest = t
    }
    return oldest
  }
}
