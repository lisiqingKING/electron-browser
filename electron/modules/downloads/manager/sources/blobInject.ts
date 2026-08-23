import path from 'node:path'
import fs from 'node:fs'
import { ipcMain, dialog } from 'electron'
import { blobChannels } from '../../channels'
import { getDownloadManager, getDownloadSaveDir } from '../index'
import { getSetting } from '../../../settings/manager'
import { broadcast } from '../../../../shared/broadcast'
import { ipcLogger } from '../../../../shared/logger'

export function getBlobInjectScript(): string {
  return `
;(function() {
  var MIME_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip'
  };

  function suggestFilename(mimeType, downloadAttr) {
    if (downloadAttr) return downloadAttr;
    var name = 'blob-download-' + Date.now();
    if (mimeType && MIME_EXT[mimeType]) return name + MIME_EXT[mimeType];
    return name;
  }

  document.addEventListener('click', function(e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href) return;
    if (!href.startsWith('blob:') && !href.startsWith('data:')) return;
    e.preventDefault();
    e.stopPropagation();

    // 路径 A：取 data-original-url / data-src（如果有 http(s) 真实地址则走 URL 下载）
    var originalUrl = a.getAttribute('data-original-url') || a.getAttribute('data-src');
    if (originalUrl && (originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
      window.ipcRenderer.invoke('downloads:direct-download-url', {
        url: originalUrl,
        filename: a.getAttribute('download') || originalUrl.split('/').pop() || 'download'
      });
      return;
    }

    // 路径 B：拿二进制数据
    var referrer = window.location.href;

    if (href.startsWith('blob:')) {
      fetch(href)
        .then(function(r) {
          if (!r.ok) throw new Error('fetch failed: ' + r.status);
          return r.blob();
        })
        .then(function(b) {
          return b.arrayBuffer().then(function(buffer) {
            var arr = Array.from(new Uint8Array(buffer));
            return { arr: arr, mimeType: b.type || null };
          });
        })
        .then(function(result) {
          return window.ipcRenderer.invoke('blob-download:write', {
            url: href,
            filename: suggestFilename(result.mimeType, a.getAttribute('download')),
            mimeType: result.mimeType,
            referrer: referrer,
            data: result.arr
          });
        })
        .catch(function(err) { console.error('[inject] blob fetch failed:', err); });
    } else if (href.startsWith('data:')) {
      var dataUrl = href.slice(5);
      var commaIdx = dataUrl.indexOf(',');
      var meta = dataUrl.slice(0, commaIdx);
      var base64 = dataUrl.slice(commaIdx + 1);
      var mimeMatch = meta.match(/^([^;]+)/);
      var mime = mimeMatch ? mimeMatch[1] : null;
      try {
        var arr = Array.from(atob(base64)).map(function(c) { return c.charCodeAt(0); });
        window.ipcRenderer.invoke('blob-download:write', {
          url: href,
          filename: suggestFilename(mime, a.getAttribute('download')),
          mimeType: mime,
          referrer: referrer,
          data: arr
        });
      } catch(err) { console.error('[inject] data URL parse failed:', err); }
    }
  }, true);
  console.log('[inject] download interceptor ready');
})();
`
}

let initialized = false

export function initBlobInject(): void {
  if (initialized) return
  initialized = true

  ipcMain.handle(blobChannels.error, async (_event, { error }) => {
    ipcLogger.error('[blobInject] blobChannels.error:', error)
  })

  ipcMain.handle(blobChannels.write, async (_event, opts: {
    savePath?: string
    filename?: string
    mimeType?: string | null
    referrer?: string | null
    url: string
    data: number[]
  }) => {
    const { savePath: providedSavePath, filename: providedFilename, mimeType, referrer, url, data } = opts
    try {
      let saveDir = getDownloadSaveDir()
      let filename = providedFilename || deriveFilenameFromUrl(url)
      let finalSavePath = providedSavePath

      if (!finalSavePath) {
        if (getSetting('download_ask_save_dir') === 'true') {
          const result = await dialog.showSaveDialog({
            title: '选择保存位置',
            defaultPath: path.join(saveDir, filename),
            filters: [{ name: '所有文件', extensions: ['*'] }],
          })
          if (result.canceled || !result.filePath) return
          finalSavePath = result.filePath
          filename = path.basename(result.filePath)
          saveDir = path.dirname(result.filePath)
        } else {
          let candidate = filename
          let counter = 1
          const ext = path.extname(candidate)
          const base = ext ? candidate.slice(0, -ext.length) : candidate
          while (fs.existsSync(path.join(saveDir, candidate))) {
            candidate = `${base} (${counter})${ext}`
            counter++
          }
          finalSavePath = path.join(saveDir, candidate)
        }
      }

      await fs.promises.writeFile(finalSavePath, Buffer.from(data))
      const manager = getDownloadManager()
      await manager.addBlobTask({ savePath: finalSavePath, filename, mimeType: mimeType || null, referrer: referrer || null, url })
      broadcast(blobChannels.done, { savePath: finalSavePath })
    } catch (err) {
      ipcLogger.error('[blobInject] write failed:', err)
    }
  })
}

function deriveFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (last) return decodeURIComponent(last)
  } catch { /* ignore */ }
  return 'download'
}
