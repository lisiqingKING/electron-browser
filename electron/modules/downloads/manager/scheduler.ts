import { DownloadTask } from './task'
import { DownloadTaskStore } from './taskStore'
import { DownloadNotifier } from './notifier'
import { downloadHttpTask } from './sources/httpSource'

const MAX_CONCURRENT = 5

// 并发调度 + 单个 HTTP 任务的 start/finish 编排.
// 持 AbortController Map (取消 in-flight 请求用), 调 task.setStatus 改 status, 调 notifier 推事件.
export class DownloadScheduler {
  private abortControllers: Map<string, AbortController> = new Map()
  private activeCount = 0

  constructor(
    private readonly store: DownloadTaskStore,
    private readonly notifier: DownloadNotifier
  ) {}

  // 新任务入队 (status='queued') 后调用, 尝试启动
  pump(): void {
    while (this.activeCount < MAX_CONCURRENT) {
      const next = this.store.pickNextRunnable()
      if (!next) return
      void this.startHttpTask(next)
    }
  }

  // 取消 in-flight 任务. 真正的状态变更 (canceled/failed) 在 startHttpTask 的 catch 里处理.
  cancel(id: string): boolean {
    const ac = this.abortControllers.get(id)
    if (!ac) return false
    ac.abort('user-canceled')
    return true
  }

  // 暂停 in-flight 任务. abort reason 区分, catch 里走 paused 分支 (而非 canceled).
  pause(id: string): boolean {
    const ac = this.abortControllers.get(id)
    if (!ac) return false
    ac.abort('user-paused')
    return true
  }

  // app 退出时
  shutdown(): void {
    for (const [, ac] of this.abortControllers.entries()) {
      ac.abort('app-shutdown')
    }
  }

  private async startHttpTask(task: DownloadTask): Promise<void> {
    this.activeCount += 1

    task.setStatus('downloading')
    this.notifier.emitProgress(task)

    const ac = new AbortController()
    this.abortControllers.set(task.id, ac)

    try {
      await downloadHttpTask(task, ac.signal, (delta, total) => {
        this.notifier.recordChunk(task, delta, total)
      })
      const stillExists = this.store.get(task.id)
      if (stillExists) {
        stillExists.setStatus('completed')
        this.notifier.finishTask(stillExists)
      }
    } catch (err) {
      const updated = this.store.get(task.id)
      if (!updated) {
        // 任务已被删除
      } else if (ac.signal.aborted) {
        const reason = String((ac.signal as any).reason ?? '')
        if (reason === 'user-paused') {
          updated.setStatus('paused')
        } else {
          updated.setStatus('canceled')
        }
        this.notifier.finishTask(updated)
      } else if (err instanceof Error && err.message === 'range-not-supported') {
        updated.setStatus('failed', '断点续传失败')
        this.notifier.finishTask(updated)
      } else {
        const msg = (err as Error)?.message || String(err)
        updated.setStatus('failed', msg)
        this.notifier.finishTask(updated)
      }
    } finally {
      this.abortControllers.delete(task.id)
      this.notifier.clearTimer(task.id)
      this.activeCount = Math.max(0, this.activeCount - 1)
      this.pump()
    }
  }
}
