export function isUrl(input: string): boolean {
  // 1. 明确的协议头
  if (/^(https?:\/\/|lsqapp:\/\/|open-lsqapp:\/\/)/i.test(input)) return true

  // 2. www. 开头
  if (/^www\./i.test(input)) return true

  // 3. localhost（可带端口和路径）
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) return true

  // 4. IP 地址（支持端口和路径）
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(input)) return true

  // 5. 域名格式：至少一段.一段，TLD 为 2-12 位纯字母（如 .com, .cn, .co.uk）
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+\.[a-zA-Z]{2,12}$/.test(input)) return true

  return false
}

export function isNewTabUrl(url: string): boolean {
  if (!url) return false
  // lsqapp://internal-app/newtab 或 http://localhost:PORT/#/newtab
  const hashIndex = url.indexOf('#/')
  if (hashIndex !== -1) {
    return url.substring(hashIndex + 2) === 'newtab'
  }
  return url.endsWith('/newtab')
}