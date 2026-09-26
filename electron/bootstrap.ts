import { registerTabHandlers } from './tabs/tabHandlers'
import { registerDownloadHandlers } from './modules/downloads/downloadHandlers'
import { registerFavoritesHandlers } from './modules/favorites/favoritesHandlers'
import { registerSettingsHandlers } from './modules/settings/settingsHandlers'
import { registerWallpaperHandlers } from './modules/wallpaper/handlers'
import { registerAIHandlers } from './modules/ai/aiHandlers'
import { registerLogsHandlers } from './modules/logs/logsHandlers'
import { registerSuggestionHandlers } from './modules/suggestions/suggestionHandlers'
import { registerModuleHandlers, type Module } from './shared/autoIpc'
import { clipboardModule } from './modules/clipboard'
import { historyModule } from './modules/history'
// import { registerUpdaterHandlers } from './modules/updater/updaterHandlers'

export function registerAllHandlers() {
  registerTabHandlers()
  registerDownloadHandlers()
  registerFavoritesHandlers()
  registerSettingsHandlers()
  registerWallpaperHandlers()
  registerAIHandlers()
  registerLogsHandlers()
  registerSuggestionHandlers()
  // registerUpdaterHandlers()

  // 简单模块自动注册
  registerModuleHandlers('clipboard', clipboardModule as Module)
  registerModuleHandlers('history', historyModule as Module)
}
