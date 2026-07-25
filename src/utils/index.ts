export function isUrl(input: string): boolean {
  return /^(https?:\/\/|www\.|lsqapp:\/\/|open-lsqapp:\/\/)[^\s]+$/i.test(input)
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