export function isUrl(input: string): boolean {
  return /^(https?:\/\/|www\.|lsqapp:\/\/|open-lsqapp:\/\/)[^\s]+$/i.test(input)
}