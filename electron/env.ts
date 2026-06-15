// 环境配置
import { app } from 'electron'

export const env = {
  getAppUrl(): string {
    if (!app.isPackaged) {
      return `http://localhost:5273/#/`
    }
    // 打包后用 lsqapp:// 协议加载内置子应用
    return 'lsqapp://internal-app'
  },

  getHistoryUrl(): string {
    if (!app.isPackaged) {
      return `http://localhost:5273/#/history`
    }
    return 'lsqapp://internal-app/history'
  },

  getDownloadsUrl(): string {
    if (!app.isPackaged) {
      return `http://localhost:5273/#/downloads`
    }
    return 'lsqapp://internal-app/downloads'
  }
}