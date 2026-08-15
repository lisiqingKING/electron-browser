import { registerTabHandlers } from './tabs/tabHandlers'
import { registerDownloadHandlers } from './modules/downloads/downloadHandlers'
import { registerHistoryHandlers } from './modules/history/historyHandlers'
import { registerFavoritesHandlers } from './modules/favorites/favoritesHandlers'
import { registerSettingsHandlers } from './modules/settings/settingsHandlers'
import { registerAIHandlers } from './modules/ai/aiHandlers'
import { registerLogsHandlers } from './modules/logs/logsHandlers'
// import { registerUpdaterHandlers } from './modules/updater/updaterHandlers'

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
