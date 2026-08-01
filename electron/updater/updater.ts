import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { broadcast } from '../broadcast'
import { updaterChannels } from './channels'

export { updaterChannels }

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateStatus {
  state: UpdateState
  info?: UpdateInfo
  progress?: { percent: number; transferred: number; total: number }
  error?: string
}

export class Updater {
  #status: UpdateStatus = { state: 'idle' }

  constructor() {
    this.#setupListeners()
  }

  #setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.#status = { state: 'checking' }
    })

    autoUpdater.on('update-available', (info) => {
      this.#status = { state: 'available', info }
      broadcast(updaterChannels.updateAvailable, { version: info.version })
    })

    autoUpdater.on('update-not-available', () => {
      this.#status = { state: 'idle' }
      broadcast(updaterChannels.updateNotAvailable)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.#status = {
        state: 'downloading',
        progress: {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total
        }
      }
      broadcast(updaterChannels.updateProgress, {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.#status = { state: 'downloaded', info }
      broadcast(updaterChannels.updateDownloaded, { version: info.version })
    })

    autoUpdater.on('error', (err) => {
      console.error('[updater] error:', err.message)
      this.#status = { state: 'error', error: err.message }
      broadcast(updaterChannels.updateError, { error: err.message })
    })
  }

  #canUpdate(): boolean {
    if (!!process.env.PORTABLE_EXECUTABLE_FILE) return false
    return true
  }

  init(): void {
    if (!this.#canUpdate()) return
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
  }

  checkForUpdates(): void {
    if (!this.#canUpdate()) return
    autoUpdater.checkForUpdates()
  }

  downloadUpdate(): void {
    if (!this.#canUpdate()) return
    autoUpdater.downloadUpdate()
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }

  getStatus(): UpdateStatus {
    return this.#status
  }
}

export const updater = new Updater()
