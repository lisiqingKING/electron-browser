import type { DownloadEvent, DownloadProgress } from '../downloadTypes'
import { DownloadTask } from './downloadTask'
import { DownloadTaskStore } from './downloadTaskStore'
import { broadcast } from '../../../shared/broadcast'

const PROGRESS_FLUSH_INTERVAL_MS = 250  // DB 写入节流
const PROGRESS_EMIT_INTERVAL_MS = 250   // IPC 推送节流 (4Hz). chunk 来再快也只发 4 次/秒, 避免 UI 闪烁.
const SPEED_WINDOW_MS = 2000            // 速度用 2s 滑动窗口均值, 比瞬时采样稳得多.

// 下载模块里唯一有权向渲染端说话的组件.
// 职责: 进度节流 (250ms) + 速度计算 (2s 窗口) + 所有 UI 事件推送 (added/removed/progress).
// 不调度, 不持 AbortController, 不读 SQLite.
export class DownloadNotifier {
  private progressTimers: Map<string, NodeJS.Timeout> = new Map()
  private emitTimers: Map<string, NodeJS.Timeout> = new Map()
  private lastFlushedReceived: Map<string, number> = new Map()
  // 速度采样数组, 每个 task 保留最近 2s 内的所有 emit 时刻的 (ts, bytes). 算速度时用首末样本.
  private speedSamples: Map<string, { ts: number; bytes: number }[]> = new Map()

  constructor(private readonly store: DownloadTaskStore) {}

  // 每个 chunk 进来调一次: 累计 + 调度一次节流后的 emit + 调度一次节流后的 DB 写
  recordChunk(task: DownloadTask, delta: number, total: number | null): void {
    if (!this.store.has(task.id)) return
    task.accumulateProgress(delta, total)
    this.scheduleProgressEmit(task)
    this.scheduleProgressFlush(task)
  }

  // 立刻把当前 received/total 写进 DB (终态前或重大节点用). task.setProgress 内部会 UPDATE.
  flushNow(task: DownloadTask): void {
    if (!this.store.has(task.id)) return
    task.setProgress(task.receivedBytes, task.totalBytes)
    this.lastFlushedReceived.set(task.id, task.receivedBytes)
  }

  // 清掉这个 task 的所有定时器 (progress flush + progress emit), 任务删除/清空时用.
  clearTimer(id: string): void {
    const flushTimer = this.progressTimers.get(id)
    if (flushTimer) {
      clearTimeout(flushTimer)
      this.progressTimers.delete(id)
    }
    const emitTimer = this.emitTimers.get(id)
    if (emitTimer) {
      clearTimeout(emitTimer)
      this.emitTimers.delete(id)
    }
  }

  // 终态: 刷新进度, 清掉节流, 推一次 progress 事件 (renderer 收到最新状态)
  finishTask(task: DownloadTask): void {
    this.clearTimer(task.id)
    this.flushNow(task)
    this.emitProgress(task)
  }

  // 立即推一次 (状态变更、终态用). 不走节流.
  emitProgress(task: DownloadTask): void {
    if (!this.store.has(task.id)) return
    const payload: DownloadProgress = {
      id: task.id,
      status: task.status,
      receivedBytes: task.receivedBytes,
      totalBytes: task.totalBytes,
      speed: this.computeSpeed(task.id, task.receivedBytes),
    }
    if (task.error) payload.error = task.error
    this.emitEvent({ type: 'progress', progress: payload } satisfies DownloadEvent)
  }

  emitAdded(task: DownloadTask): void {
    this.emitEvent({ type: 'added', task: task.toJSON() as unknown as DownloadTask } satisfies DownloadEvent)
  }

  emitRemoved(id: string): void {
    this.emitEvent({ type: 'removed', id } satisfies DownloadEvent)
  }

  shutdown(): void {
    for (const [, timer] of this.progressTimers.entries()) {
      clearTimeout(timer)
    }
    this.progressTimers.clear()
    for (const [, timer] of this.emitTimers.entries()) {
      clearTimeout(timer)
    }
    this.emitTimers.clear()
    this.speedSamples.clear()
  }

  // 节流 flush: 250ms 内多次 chunk 只写一次 DB
  private scheduleProgressFlush(task: DownloadTask): void {
    if (!this.store.has(task.id)) return
    if (this.progressTimers.has(task.id)) return
    const timer = setTimeout(() => {
      this.progressTimers.delete(task.id)
      this.flushNow(task)
    }, PROGRESS_FLUSH_INTERVAL_MS)
    this.progressTimers.set(task.id, timer)
  }

  // 节流 emit: 250ms 内多次 chunk 只推一次 IPC 事件. UI 更新频率 4Hz, 平滑不闪.
  private scheduleProgressEmit(task: DownloadTask): void {
    if (!this.store.has(task.id)) return
    if (this.emitTimers.has(task.id)) return
    const timer = setTimeout(() => {
      this.emitTimers.delete(task.id)
      this.emitProgress(task)
    }, PROGRESS_EMIT_INTERVAL_MS)
    this.emitTimers.set(task.id, timer)
  }

  // 滑动窗口速度: 用最近 2s 内的 (ts, bytes) 样本, 取首末两点算 (bytes差 / 时间差).
  // 比单点采样稳, 8 个采样做底, 抗抖动.
  private computeSpeed(taskId: string, receivedBytes: number): number {
    const now = Date.now()
    let samples = this.speedSamples.get(taskId) ?? []
    samples.push({ ts: now, bytes: receivedBytes })
    const cutoff = now - SPEED_WINDOW_MS
    samples = samples.filter((s) => s.ts >= cutoff)
    this.speedSamples.set(taskId, samples)
    if (samples.length < 2) return 0
    const first = samples[0]
    const last = samples[samples.length - 1]
    const dt = (last.ts - first.ts) / 1000
    if (dt <= 0) return 0
    return Math.round((last.bytes - first.bytes) / dt)
  }

  private emitEvent(event: DownloadEvent): void {
    this.emitRaw('downloads:event', event)
  }

  private emitRaw(channel: string, payload: unknown): void {
    broadcast(channel, payload)
  }
}
