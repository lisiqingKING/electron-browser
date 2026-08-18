import path from 'node:path'
import fs from 'node:fs'
import { app, dialog, type Session, type WebContents, type Event } from 'electron'
import { getDownloadManager, getDownloadSaveDir } from '../'
import { getSetting } from '../../../settings/manager'
import { getBlobInjectScript, initBlobInject } from './blobInject'

let initialized = false
const registeredSessions: WeakSet<Session> = new WeakSet()

function uniqueFilename(saveDir: string, desired: string): string {
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

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

async function handleWillDownload(event: Event, item: Electron.DownloadItem, webContents: WebContents): Promise<void> {
  const url = item.getURL()

  // blob / data URL：由 INJECT_SCRIPT 在点击时拦截，will-download 不会命中
  // file URL：让 Chromium 默认处理
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('file:')) {
    return
  }

  const itemFilename = item.getFilename()
  const originalFilename = itemFilename || 'download'
  const referrer = webContents.getURL() || null
  const mimeType = item.getMimeType() || null
  let saveDir = getDownloadSaveDir()
  let filename = originalFilename

  event.preventDefault()

  if (getSetting('download_ask_save_dir') === 'true') {
    const result = await dialog.showSaveDialog({
      title: '选择保存位置',
      defaultPath: originalFilename,
      filters: [{ name: '所有文件', extensions: ['*'] }],
    })
    if (result.canceled || !result.filePath) return
    saveDir = normalizePath(path.dirname(result.filePath))
    filename = path.basename(result.filePath)
  } else {
    filename = uniqueFilename(saveDir, originalFilename)
  }

  const manager = getDownloadManager()
  // saveDir 内部使用，不在 AddHttpInput public type 里
  ;(manager.addHttpTask as any)({
    url,
    filename,
    saveDir,
    method: 'GET',
    headers: {},
    referrer,
    mimeType,
  })
}

function register(s: Session): void {
  if (registeredSessions.has(s)) return
  registeredSessions.add(s)
  s.on('will-download', (event: Event, item: Electron.DownloadItem, webContents: WebContents) => {
    handleWillDownload(event, item, webContents)
  })
}

export function initWebviewSource(): void {
  if (initialized) return
  initialized = true

  // 注册 blobChannels handlers
  initBlobInject()

  app.on('web-contents-created', (_event, contents) => {
    register(contents.session)
    contents.on('did-finish-load', () => {
      if (!contents.isDestroyed()) {
        contents.executeJavaScript(getBlobInjectScript()).catch(() => {})
      }
    })
  })
}
