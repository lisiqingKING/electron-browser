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

export async function fetchIconAsBase64(iconUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    let request: ReturnType<typeof net.request>
    try {
      request = net.request(iconUrl)
    } catch {
      resolve(null)
      return
    }

    const chunks: Buffer[] = []

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        resolve(null)
        return
      }

      response.on('data', (chunk) => {
        if (chunk) chunks.push(chunk as Buffer)
      })

      response.on('end', () => {
        if (chunks.length === 0) {
          resolve(null)
          return
        }

        const buffer = Buffer.concat(chunks)
        const mimeType = detectImageMimeType(buffer)
        const base64 = arrayBufferToBase64(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
        resolve(`data:${mimeType};base64,${base64}`)
      })

      response.on('error', () => {
        resolve(null)
      })
    })

    request.on('error', () => {
      resolve(null)
    })

    request.end()
  })
}

export async function getOrFetchIcon(pageUrl: string, iconUrl: string): Promise<string | null> {
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
    const base64 = await fetchIconAsBase64(iconUrl)
    if (base64) {
      saveIcon(pageUrl, base64, iconUrl)
      iconCache.set(pageUrl, base64)
    }
    return base64
  } catch {
    return null
  }
}
