import path from 'node:path'
import fs from 'node:fs'
import { app, type Session, type WebContents, type Event } from 'electron'
import { getDownloadManager } from '../'

let initialized = false
const registeredSessions: WeakSet<Session> = new WeakSet()

// 生成唯一文件名, 避免与已有文件冲突
function uniqueFilename(saveDir: string, desired: string): string {
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

function register(s: Session): void {
  if (registeredSessions.has(s)) return
  registeredSessions.add(s)
  s.on('will-download', (event: Event, item, webContents: WebContents) => {
    // 关键: 拦截! 不让 Chromium 接管, 也不让它写临时 .crdownload
    // 主进程拿到 URL 后用 http.request 自己拉, 这样下载/暂停/续传完全可控
    event.preventDefault()

    const url = item.getURL()
    const originalFilename = item.getFilename() || 'download'
    const saveDir = app.getPath('downloads')
    const filename = uniqueFilename(saveDir, originalFilename)
    const referrer = webContents.getURL() || null
    const mimeType = item.getMimeType() || null

    const manager = getDownloadManager()
    manager.addHttpTask({
      url,
      filename,
      method: 'GET',
      headers: {},
      referrer,
      mimeType,
    })
  })
}

export function initWebviewSource(): void {
  if (initialized) return
  initialized = true

  // 每个 webContents 出来时, 拿它实际用的 session 注册 will-download.
  // 这样不依赖 session-created (它不会为启动时已存在的 persist:default 触发),
  // 也不依赖 defaultSession 是不是 webContents 实际用的那个 (BrowserWindow /
  // WebContentsView 默认用 persist:default, 而 defaultSession 等价于空 partition).
  app.on('web-contents-created', (_event, contents) => {
    register(contents.session)
  })
}
