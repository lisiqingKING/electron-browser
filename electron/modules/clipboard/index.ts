import { clipboard } from 'electron'

export const clipboardModule = {
  readText: () => clipboard.readText(),
  writeText: (text: string) => { clipboard.writeText(text) },
}
