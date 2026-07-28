import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { app } from 'electron'
import { broadcast } from '../broadcast'
import { updaterChannels } from './channels'

interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  info?: UpdateInfo
  progress?: { percent: number; transferred: number; total: number }
  error?: string
}

let status: UpdateStatus = { state: 'idle' }

function isPortable(): boolean {
  return !!process.env.PORTABLE_EXECUTABLE_FILE
}

function canUpdate(): boolean {
  return app.isPackaged && !isPortable()
}

export function initUpdater(): void {
  if (!canUpdate()) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    status = { state: 'checking' }
  })

  autoUpdater.on('update-available', (info) => {
    status = { state: 'available', info }
    broadcast(updaterChannels.updateAvailable, { version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    status = { state: 'idle' }
    broadcast(updaterChannels.updateNotAvailable)
  })

  autoUpdater.on('download-progress', (progress) => {
    status = {
      state: 'downloading',
      progress: { percent: progress.percent, transferred: progress.transferred, total: progress.total }
    }
    broadcast(updaterChannels.updateProgress, {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    status = { state: 'downloaded', info }
    broadcast(updaterChannels.updateDownloaded, { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    status = { state: 'error', error: err.message }
    broadcast(updaterChannels.updateError, { error: err.message })
  })
}

export function checkForUpdates(): void {
  if (!canUpdate()) return
  autoUpdater.checkForUpdates()
}

export function downloadUpdate(): void {
  if (!canUpdate()) return
  autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true)
}

export function getUpdateStatus(): UpdateStatus {
  return status
}
