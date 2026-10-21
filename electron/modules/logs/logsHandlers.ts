import { ipcMain } from 'electron'
import { listLogFiles, readLogFile, getLogDir, type ListLogFilesOptions } from './manager'
import { renderLogger } from '../../shared/logger'

export function registerLogsHandlers() {
  ipcMain.handle('logs:list', (_event, options?: ListLogFilesOptions) => {
    return listLogFiles(options)
  })

  ipcMain.handle('logs:read', (_event, module: string, filename: string, limit?: number) => {
    return readLogFile(module, filename, limit)
  })

  ipcMain.handle('logs:dir', () => {
    return getLogDir()
  })

  // 接收渲染进程传来的 JS 错误，写入 render/ 日志
  ipcMain.on('render:error', (_event, data: { message: string; stack?: string; url?: string; line?: number }) => {
    const msg = data.stack
      ? `${data.message}\n  at ${data.stack}`
      : data.message
    renderLogger.error(`[renderer] ${msg}`)
  })
}
