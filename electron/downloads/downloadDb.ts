import { getDatabase } from '../database'
import type { DownloadStatus } from './downloadTypes'
import { DownloadTask } from './internal/downloadTask'

interface DownloadRow {
  id: string
  url: string
  method: string
  post_body: string | null
  headers: string
  filename: string
  save_dir: string
  total_bytes: number | null
  received_bytes: number
  status: string
  error: string | null
  referrer: string | null
  mime_type: string | null
  created_at: number
  updated_at: number
}

function rowToTask(row: DownloadRow): DownloadTask {
  let parsedHeaders: Record<string, string> = {}
  try {
    const v = JSON.parse(row.headers || '{}')
    if (v && typeof v === 'object') parsedHeaders = v as Record<string, string>
  } catch {
    parsedHeaders = {}
  }
  return DownloadTask.fromRow({
    id: row.id,
    url: row.url,
    method: row.method,
    postBody: row.post_body,
    headers: parsedHeaders,
    filename: row.filename,
    saveDir: row.save_dir,
    totalBytes: row.total_bytes,
    receivedBytes: row.received_bytes ?? 0,
    status: row.status as DownloadStatus,
    error: row.error,
    referrer: row.referrer,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

export function getAllDownloads(): DownloadTask[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, url, method, post_body, headers, filename, save_dir,
              total_bytes, received_bytes, status, error, referrer, mime_type,
              created_at, updated_at
         FROM downloads
        ORDER BY created_at DESC`
    )
    .all() as DownloadRow[]
  return rows.map(rowToTask)
}

export function insertDownload(task: DownloadTask): void {
  getDatabase()
    .prepare(
      `INSERT INTO downloads
        (id, url, method, post_body, headers, filename, save_dir,
         total_bytes, received_bytes, status, error, referrer, mime_type,
         created_at, updated_at)
       VALUES
        (@id, @url, @method, @post_body, @headers, @filename, @save_dir,
         @total_bytes, @received_bytes, @status, @error, @referrer, @mime_type,
         @created_at, @updated_at)`
    )
    .run({
      id: task.id,
      url: task.url,
      method: task.method,
      post_body: task.postBody,
      headers: JSON.stringify(task.headers || {}),
      filename: task.filename,
      save_dir: task.saveDir,
      total_bytes: task.totalBytes,
      received_bytes: task.receivedBytes,
      status: task.status,
      error: task.error,
      referrer: task.referrer,
      mime_type: task.mimeType,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    })
}

export function updateDownloadStatus(
  id: string,
  status: DownloadStatus,
  error: string | null,
  updatedAt: number
): void {
  getDatabase()
    .prepare(
      `UPDATE downloads
          SET status = ?, error = ?, updated_at = ?
        WHERE id = ?`
    )
    .run(status, error, updatedAt, id)
}

export function updateDownloadProgress(
  id: string,
  receivedBytes: number,
  totalBytes: number | null,
  updatedAt: number
): void {
  getDatabase()
    .prepare(
      `UPDATE downloads
          SET received_bytes = ?, total_bytes = ?, updated_at = ?
        WHERE id = ?`
    )
    .run(receivedBytes, totalBytes, updatedAt, id)
}

export function deleteDownloadById(id: string): void {
  getDatabase().prepare(`DELETE FROM downloads WHERE id = ?`).run(id)
}

export function deleteAllDownloads(): number {
  const info = getDatabase().prepare(`DELETE FROM downloads`).run()
  return info.changes
}
