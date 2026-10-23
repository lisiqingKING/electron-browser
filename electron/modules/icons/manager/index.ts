import { net } from 'electron'
import { getIconByUrl, saveIcon } from '../iconsDb'

const iconCache = new Map<string, string>()

export function syncFromDb(): void {
  iconCache.clear()
}

export function getCachedIcon(pageUrl: string): string | undefined {
  return iconCache.get(pageUrl)
}

export function getIconFromDb(pageUrl: string): string | undefined {
  const record = getIconByUrl(pageUrl)
  if (record) {
    return record.icon
  }
  return undefined
}

function detectImageMimeType(data: Buffer): string {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif'
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return 'image/webp'
  if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) return 'image/x-icon'
  if (data[0] === 0x3c && data[1] === 0x73) return 'image/svg+xml'
  return 'image/png'
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function fetchIconAsBase64(iconUrl: string, timeoutMs?: number): Promise<string | null> {
  return new Promise((resolve) => {
    let request: ReturnType<typeof net.request>
    try {
      request = net.request(iconUrl)
    } catch {
      resolve(null)
      return
    }

    let settled = false
    let timer: NodeJS.Timeout | undefined
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(value)
    }

    // 服务器不回数据时请求会一直挂着，Promise 永不 settle
    if (timeoutMs) {
      timer = setTimeout(() => {
        try {
          request.abort()
        } catch {
          // 请求已结束
        }
        finish(null)
      }, timeoutMs)
    }

    const chunks: Buffer[] = []

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        finish(null)
        return
      }

      response.on('data', (chunk) => {
        if (chunk) chunks.push(chunk as Buffer)
      })

      response.on('end', () => {
        if (chunks.length === 0) {
          finish(null)
          return
        }

        const buffer = Buffer.concat(chunks)
        const mimeType = detectImageMimeType(buffer)
        const base64 = arrayBufferToBase64(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
        finish(`data:${mimeType};base64,${base64}`)
      })

      response.on('error', () => {
        finish(null)
      })
    })

    request.on('error', () => {
      finish(null)
    })

    request.end()
  })
}

export async function getOrFetchIcon(
  pageUrl: string,
  iconUrl: string,
  timeoutMs?: number
): Promise<string | null> {
  const cached = iconCache.get(pageUrl)
  if (cached) return cached

  const fromDb = getIconFromDb(pageUrl)
  if (fromDb) {
    iconCache.set(pageUrl, fromDb)
    return fromDb
  }

  if (!iconUrl.startsWith('http://') && !iconUrl.startsWith('https://')) {
    return null
  }

  try {
    const base64 = await fetchIconAsBase64(iconUrl, timeoutMs)
    if (base64) {
      saveIcon(pageUrl, base64, iconUrl)
      iconCache.set(pageUrl, base64)
    }
    return base64
  } catch {
    return null
  }
}

/**
 * 猜测页面 favicon 的位置。
 *
 * 只探测 origin 根下的 /favicon.ico —— 解析 HTML 里的 <link rel="icon">
 * 需要额外抓一次页面并解析，命中率与成本不成正比（YAGNI）。
 */
export function guessFaviconUrl(pageUrl: string): string | null {
  try {
    const parsed = new URL(pageUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${parsed.origin}/favicon.ico`
  } catch {
    return null
  }
}

/**
 * 抓取某个页面的图标（快捷方式这类"从未打开过的站点"用）。
 * 命中 page_icons 缓存则直接返回，失败返回 null，由调用方回退到占位图。
 */
export async function fetchIconForPage(pageUrl: string, timeoutMs = 5000): Promise<string | null> {
  const iconUrl = guessFaviconUrl(pageUrl)
  if (!iconUrl) return null
  return getOrFetchIcon(pageUrl, iconUrl, timeoutMs)
}
