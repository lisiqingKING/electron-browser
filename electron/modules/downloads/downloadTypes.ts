// 下载管理器的核心类型定义

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled'

export interface DownloadTask {
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
}

export interface DownloadProgress {
  id: string
  status: DownloadStatus
  receivedBytes: number
  totalBytes: number | null
  speed: number
  error?: string
}

export type DownloadEvent =
  | { type: 'added'; task: DownloadTask }
  | { type: 'progress'; progress: DownloadProgress }
  | { type: 'removed'; id: string }

export interface AddHttpInput {
  url: string
  filename?: string
  // saveDir 由 handler 内部处理，不暴露给 caller
  method?: 'GET' | 'POST'
  postBody?: string | null
  headers?: Record<string, string>
  referrer?: string | null
  mimeType?: string | null
}

export function isTerminalStatus(status: DownloadStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'canceled'
}
