import { registerTabHandlers } from './tabs/tabHandlers'
import { registerHistoryHandlers } from './features/history/historyHandlers'
import { registerFavoritesHandlers } from './features/favorites/favoritesHandlers'
import { registerSettingsHandlers } from './features/settings/settingsHandlers'
import { registerAIHandlers } from './features/ai/aiHandlers'
import { registerLogsHandlers } from './features/logs/logsHandlers'

export function registerAllHandlers() {
  registerTabHandlers()
  registerHistoryHandlers()
  registerFavoritesHandlers()
  registerSettingsHandlers()
  registerAIHandlers()
  registerLogsHandlers()
}
