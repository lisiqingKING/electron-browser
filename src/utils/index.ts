export function isUrl(input: string): boolean {
  return /^(https?:\/\/|www\.)[^\s]+$/i.test(input)
}