import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { LOG_MODULES } from '../../../shared/logger'

export interface LogFileEntry {
  module: string
  filename: string
  date: string
}

export interface ListLogFilesOptions {
  modules?: string[]
  startDate?: string
  endDate?: string
}

function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(/^.+-(\d{4})-(\d{2})-(\d{2})\.log$/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function listLogFiles(options?: ListLogFilesOptions): LogFileEntry[] {
  const logDir = app.getPath('logs')
  const modules = options?.modules?.length ? options.modules : [...LOG_MODULES]
  const startDate = options?.startDate
  const endDate = options?.endDate

  const result: LogFileEntry[] = []

  for (const module of modules) {
    const moduleDir = path.join(logDir, module)
    let files: string[] = []
    try {
      files = fs.readdirSync(moduleDir).filter(f => f.endsWith('.log'))
    } catch {
      continue
    }

    for (const filename of files) {
      const date = parseDateFromFilename(filename)
      if (!date || filename.includes('{y}')) continue
      if (startDate && date < startDate) continue
      if (endDate && date > endDate) continue
      result.push({ module, filename, date })
    }
  }

  result.sort((a, b) => b.date.localeCompare(a.date))
  return result
}

export function readLogFile(module: string, filename: string, limit: number = 500): string {
  const filePath = path.join(app.getPath('logs'), module, filename)
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    return lines.slice(-limit).join('\n')
  } catch {
    return ''
  }
}

export function getLogDir(): string {
  return app.getPath('logs')
}
