export function isUrl(input: string): boolean {
  return /^(https?:\/\/|www\.|lsqapp:\/\/|open-lsqapp:\/\/)[^\s]+$/i.test(input)
}

export function isNewTabUrl(url: string): boolean {
  if (!url) return false
  return url.includes('/newtab')
}