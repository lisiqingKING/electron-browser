import {
  getAllShortcuts,
  getShortcutById,
  getShortcutByUrl,
  insertShortcut,
  deleteShortcut,
  updateShortcutIcon,
  type Shortcut,
} from '../shortcutsDb'

const MAX_NAME_LENGTH = 32
const MAX_URL_LENGTH = 2048
const MAX_HOSTNAME_LENGTH = 253
const MAX_LABEL_LENGTH = 63

/** 控制字符（含换行、制表符）会破坏界面排版 */
function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 32 || code === 127) return true
  }
  return false
}

/**
 * 校验 hostname。
 *
 * new URL 对 "abc" / "example..com" 这类输入是接受的（解析成功），
 * 但它们根本不是一个能打开的域名 —— 浏览器拿到 https://abc 只会当成搜索词。
 * 所以这里按 DNS 规范再卡一道。
 */
export function isValidHostname(hostname: string): boolean {
  if (!hostname) return false
  if (hostname.length > MAX_HOSTNAME_LENGTH) return false

  // IPv6：new URL 会保留方括号
  if (hostname.startsWith('[')) return true

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return hostname.split('.').every((part) => Number(part) <= 255)
  }

  if (hostname === 'localhost') return true

  // 其余必须像域名：含点、每段非空且 ≤63 字符、只允许字母数字和连字符
  if (!hostname.includes('.')) return false
  return hostname
    .split('.')
    .every(
      (label) =>
        label.length > 0 && label.length <= MAX_LABEL_LENGTH && /^[a-z0-9-]+$/.test(label)
    )
}

/**
 * 归一化用户输入的网址。
 * 补全缺失的协议、去掉根路径末尾斜杠 —— 让 "example.com" 和 "https://example.com/"
 * 落到同一个 url 上，否则唯一约束拦不住重复添加。
 */
export function normalizeShortcutUrl(input: string): string {
  const trimmed = (input ?? '').trim()
  if (!trimmed) throw new Error('网址不能为空')
  if (trimmed.length > MAX_URL_LENGTH) throw new Error(`网址不能超过 ${MAX_URL_LENGTH} 个字符`)

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error('网址格式不合法')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https 网址')
  }
  if (!parsed.hostname) throw new Error('网址格式不合法')
  if (!isValidHostname(parsed.hostname)) {
    throw new Error('网址格式不合法：域名看起来不像网址，请检查是否漏了后缀')
  }

  return parsed.toString().replace(/\/$/, '')
}

/** 名称为空时用 hostname 兜底，www. 前缀去掉更好认 */
export function resolveShortcutName(name: string | undefined, url: string): string {
  const trimmed = (name ?? '').trim()
  if (trimmed) {
    if (trimmed.length > MAX_NAME_LENGTH) throw new Error(`名称不能超过 ${MAX_NAME_LENGTH} 个字符`)
    if (hasControlChars(trimmed)) throw new Error('名称不能包含换行等控制字符')
    return trimmed
  }
  const hostname = new URL(url).hostname.replace(/^www\./, '')
  return hostname || url
}

export function addShortcut(input: { name?: string; url: string }): Shortcut {
  const url = normalizeShortcutUrl(input?.url ?? '')
  if (getShortcutByUrl(url)) throw new Error('该快捷方式已存在')

  const name = resolveShortcutName(input?.name, url)
  const now = Date.now()
  const shortcut: Shortcut = {
    id: `short-${crypto.randomUUID()}`,
    name,
    url,
    icon: null,
    createdAt: now,
    updatedAt: now,
  }
  insertShortcut(shortcut)
  return shortcut
}

export function removeShortcut(id: string): boolean {
  if (!getShortcutById(id)) return false
  deleteShortcut(id)
  return true
}

/** favicon 抓取成功后回填；抓取失败保持 null，前端回退到首字母色块 */
export function setShortcutIcon(id: string, icon: string | null): void {
  updateShortcutIcon(id, icon, Date.now())
}

export { getAllShortcuts }
export type { Shortcut }
