// Re-export from modules/tabContext for backward compatibility
// New code should import directly from ../modules/tabContext
import type { TabInfo, TabContext } from '../modules/tabContext'
export type { TabInfo, TabContext }
export { getTabContext, getCurTab, setCurTabId, getTabListData, createTabCore, switchTab, closeTab, updateCurTabBounds } from '../modules/tabContext'

// History
export { tabHistoryMap, pushHistory, goBackInHistory, goForwardInHistory, canGoBackInHistory, canGoForwardInHistory, removeHistory, type TabHistoryEntry, type TabHistory } from '../modules/tabHistory'

// Utilities
export { DEFAULT_TAB, isLocalFile, isAppUrl, getDomainFromUrl, isInternalUrl, isInternalTab, findExistingInternalTab, switchToExistingTab, getTitleForInternalUrl } from '../modules/tabCoreUtils'
