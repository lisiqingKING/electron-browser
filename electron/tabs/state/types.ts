import { WebContentsView } from 'electron'

export interface TabInfo {
  title: string
  url: string
  actualUrl?: string
  time?: number
  id?: string
  wcId?: number
  canGoBack?: boolean
  canGoForward?: boolean
  isLoading?: boolean
  favicon?: string
  isHome?: boolean
  loadError?: {
    url: string
    code: number
    message: string
  }
}

export interface TabContext {
  tabs: TabInfo[]
  curTabId: string | null
  webContentViewMap: Map<string, { info: TabInfo; view: WebContentsView }>
}
