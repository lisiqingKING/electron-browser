export const updaterChannels = {
  // renderer -> main (invoke)
  checkForUpdates: 'updater:check-for-updates',
  downloadUpdate: 'updater:download-update',
  quitAndInstall: 'updater:quit-and-install',
  getUpdateStatus: 'updater:get-update-status',

  // main -> renderer (push events)
  updateAvailable: 'updater:update-available',
  updateNotAvailable: 'updater:update-not-available',
  updateDownloaded: 'updater:update-downloaded',
  updateProgress: 'updater:update-progress',
  updateError: 'updater:update-error',
} as const
