import { randomUUID } from 'node:crypto'
import type { AddHttpInput, DownloadStatus, DownloadTask as DownloadTaskShape } from '../downloadTypes'
import { isTerminalStatus } from '../downloadTypes'
import { updateDownloadStatus, updateDownloadProgress } from '../downloadDb'

// 下载任务的内存模型 + 状态机 + 自身行的持久化都在这个 class 里.
// 不可变字段: id / url / method / postBody / headers / filename / saveDir / referrer / mimeType / createdAt
// 可变字段走 getter 暴露, 变更必须通过 setStatus / setProgress——内部直接写回 DB.
export class DownloadTask {
  readonly id: string
  readonly url: string
  readonly method: string
  readonly postBody: string | null
  readonly headers: Record<string, string>
  readonly filename: string
  readonly saveDir: string
  readonly referrer: string | null
  readonly mimeType: string | null
  readonly createdAt: number

  private _totalBytes: number | null
  private _receivedBytes: number
  private _status: DownloadStatus
  private _error: string | null
  private _updatedAt: number

  private constructor(args: {
    id: string
    url: string
    method: string
    postBody: string | null
    headers: Record<string, string>
    filename: string
    saveDir: string
    totalBytes: number | null
    receivedBytes: number
    status: DownloadStatus
    error: string | null
    referrer: string | null
    mimeType: string | null
    createdAt: number
    updatedAt: number
  }) {
    this.id = args.id
    this.url = args.url
    this.method = args.method
    this.postBody = args.postBody
    this.headers = args.headers
    this.filename = args.filename
    this.saveDir = args.saveDir
    this.referrer = args.referrer
    this.mimeType = args.mimeType
    this.createdAt = args.createdAt
    this._totalBytes = args.totalBytes
    this._receivedBytes = args.receivedBytes
    this._status = args.status
    this._error = args.error
    this._updatedAt = args.updatedAt
  }

  get totalBytes(): number | null { return this._totalBytes }
  get receivedBytes(): number { return this._receivedBytes }
  get status(): DownloadStatus { return this._status }
  get error(): string | null { return this._error }
  get updatedAt(): number { return this._updatedAt }

  // 跨 IPC 边界必须用: structured clone 不抓 getter, 只有 own enumerable 才会过去.
  toJSON(): DownloadTaskShape {
    return {
      id: this.id,
      url: this.url,
      method: this.method,
      postBody: this.postBody,
      headers: this.headers,
      filename: this.filename,
      saveDir: this.saveDir,
      referrer: this.referrer,
      mimeType: this.mimeType,
      createdAt: this.createdAt,
      totalBytes: this._totalBytes,
      receivedBytes: this._receivedBytes,
      status: this._status,
      error: this._error,
      updatedAt: this._updatedAt,
    }
  }

  setStatus(status: DownloadStatus, error: string | null = null): void {
    this._status = status
    this._error = error
    this._updatedAt = Date.now()
    updateDownloadStatus(this.id, this._status, this._error, this._updatedAt)
  }

  // 累计已收字节 (高频, 内存级别, 不落盘——由 notifier 节流后通过 setProgress 写)
  accumulateProgress(delta: number, total: number | null): void {
    this._receivedBytes += delta
    if (total != null) this._totalBytes = total
  }

  // 服务端不支持 Range 时, 落盘文件作废, 内存计数清零
  resetReceivedBytes(): void {
    this._receivedBytes = 0
  }

  // 节流 flush 用: 把当前累计值原样写回内存 + DB, 刷 updatedAt
  setProgress(receivedBytes: number, totalBytes: number | null): void {
    this._receivedBytes = receivedBytes
    this._totalBytes = totalBytes
    this._updatedAt = Date.now()
    updateDownloadProgress(this.id, this._receivedBytes, this._totalBytes, this._updatedAt)
  }

  // 状态查询 (UI 按钮启用禁用 / 过滤)
  isTerminal(): boolean { return isTerminalStatus(this._status) }
  isActive(): boolean { return this._status === 'downloading' || this._status === 'queued' }
  canPause(): boolean { return this._status === 'downloading' }
  canResume(): boolean { return this._status === 'paused' || this._status === 'failed' || this._status === 'canceled' }
  canCancel(): boolean { return !this.isTerminal() }

  // 工厂

  static createHttp(input: AddHttpInput, saveDir: string, filename: string): DownloadTask {
    const method = input.method ?? 'GET'
    const now = Date.now()
    return new DownloadTask({
      id: randomUUID(),
      url: input.url,
      method,
      postBody: method === 'POST' ? input.postBody ?? null : null,
      headers: input.headers ?? {},
      filename,
      saveDir,
      totalBytes: null,
      receivedBytes: 0,
      status: 'queued',
      error: null,
      referrer: input.referrer ?? null,
      mimeType: input.mimeType ?? null,
      createdAt: now,
      updatedAt: now,
    })
  }

  // 从 DB 加载历史行时用 (不走默认的 queued 状态)
  static fromRow(args: {
    id: string
    url: string
    method: string
    postBody: string | null
    headers: Record<string, string>
    filename: string
    saveDir: string
    totalBytes: number | null
    receivedBytes: number
    status: DownloadStatus
    error: string | null
    referrer: string | null
    mimeType: string | null
    createdAt: number
    updatedAt: number
  }): DownloadTask {
    return new DownloadTask(args)
  }
}
