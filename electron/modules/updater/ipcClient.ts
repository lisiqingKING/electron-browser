import { updaterChannels } from './channels'

// Push channels that renderer subscribes to (not invoke-able)
const pushChannels = new Set<string>([
  updaterChannels.updateAvailable,
  updaterChannels.updateNotAvailable,
  updaterChannels.updateDownloaded,
  updaterChannels.updateProgress,
  updaterChannels.updateError,
])

export function createUpdaterProxy(ipcRenderer: Electron.IpcRenderer) {
  const proxy: Record<string, Function> = {}

  for (const [method, channel] of Object.entries(updaterChannels)) {
    if (pushChannels.has(channel as string)) continue
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }

  return proxy
}

export type UpdaterModule = ReturnType<typeof createUpdaterProxy>
