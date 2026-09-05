import { ipcRenderer } from 'electron'

export const suggestionChannels = {
  get: 'suggestions:get',
}

export function createSuggestionsProxy() {
  return {
    get: (...args: unknown[]) => ipcRenderer.invoke(suggestionChannels.get, ...args),
  }
}

export type SuggestionsModule = ReturnType<typeof createSuggestionsProxy>
