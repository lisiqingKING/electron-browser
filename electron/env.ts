// 环境配置
import { app } from 'electron'

export const env = {
  getUrl(route?: string): string {
    if (!app.isPackaged) {
      return route ? `http://localhost:5273/#/${route}` : `http://localhost:5273/#/`
    }
    return route ? `lsqapp://internal-app/${route}` : 'lsqapp://internal-app'
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
      return `http://localhost:5273/#/${route}`
    }
    return `lsqapp://internal-app/${route}`
  }
}
