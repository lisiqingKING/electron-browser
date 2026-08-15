import { registerTabHandlers } from './tabs/tabHandlers'
import { registerDownloadHandlers } from './features/downloads/downloadHandlers'
import { registerHistoryHandlers } from './features/history/historyHandlers'
import { registerFavoritesHandlers } from './features/favorites/favoritesHandlers'
import { registerSettingsHandlers } from './features/settings/settingsHandlers'
import { registerAIHandlers } from './features/ai/aiHandlers'
import { registerLogsHandlers } from './features/logs/logsHandlers'
// import { registerUpdaterHandlers } from './features/updater/updaterHandlers'

export function registerAllHandlers() {
  registerTabHandlers()
  registerDownloadHandlers()
  registerHistoryHandlers()
  registerFavoritesHandlers()
  registerSettingsHandlers()
  registerAIHandlers()
  registerLogsHandlers()
  // registerUpdaterHandlers()
}
