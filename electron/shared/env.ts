// 环境配置
import { app } from 'electron'

export const DEV_PORT = 5273

export const PROTOCOL_LSQAPP = 'lsqapp'
export const PROTOCOL_INTERNAL_APP = 'internal-app'

export const env = {
  getUrl(route?: string): string {
    if (!app.isPackaged) {
      return route ? `http://localhost:${DEV_PORT}/#/${route}` : `http://localhost:${DEV_PORT}/#/`
    }
    return route ? `${PROTOCOL_LSQAPP}://${PROTOCOL_INTERNAL_APP}/${route}` : `${PROTOCOL_LSQAPP}://${PROTOCOL_INTERNAL_APP}`
  },

  getAppUrl(): string {
    return this.getUrl()
  },

  getHistoryUrl(): string {
    return this.getUrl('history')
  },

  getDownloadsUrl(): string {
    return this.getUrl('downloads')
  },

  getNewTabUrl(): string {
    return this.getUrl('newtab')
  },

  getSettingsUrl(): string {
    return this.getUrl('settings')
  },

  getAIUrl(): string {
    return this.getUrl('ai')
  },

  getAiSavesUrl(): string {
    return this.getUrl('ai-saves')
  },

  getFavoritesUrl(): string {
    return this.getUrl('favorites')
  },

  getLogsUrl(): string {
    return this.getUrl('logs')
  },

  getErrorUrl(params: { url: string; code: number; error: string }): string {
    const query = new URLSearchParams({
      url: params.url,
      code: params.code.toString(),
      error: params.error
    }).toString()
    const route = `error?${query}`
    if (!app.isPackaged) {
      return `http://localhost:${DEV_PORT}/#/${route}`
    }
    return `${PROTOCOL_LSQAPP}://${PROTOCOL_INTERNAL_APP}/${route}`
  }
}
