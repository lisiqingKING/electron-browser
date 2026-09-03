import { ipcRenderer } from 'electron'

export const suggestionChannels = {
  get: 'suggestions:get',
}

export function createSuggestionsProxy() {
  return {
    get: () => ipcRenderer.invoke(suggestionChannels.get),
  }
}

export type SuggestionsModule = ReturnType<typeof createSuggestionsProxy>
