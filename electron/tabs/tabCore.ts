// Re-export from state/ for backward compatibility
import type { TabInfo, TabContext } from './state'
export type { TabInfo, TabContext }
export { getTabContext, getCurTab, setCurTabId, getTabListData, createTabCore, switchTab, closeTab, updateCurTabBounds } from './state'

// History
export { tabNavHistoryMap, pushHistory, goBackInHistory, goForwardInHistory, canGoBackInHistory, canGoForwardInHistory, removeNavHistory, type TabHistoryEntry, type TabHistory } from './state/history'

// Utilities
export { DEFAULT_TAB, isLocalFile, isAppUrl, getDomainFromUrl, isInternalUrl, isInternalTab, findExistingInternalTab, switchToExistingTab, getTitleForInternalUrl, escapeForJsString } from './state/coreUtils'
