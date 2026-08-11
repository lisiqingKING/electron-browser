// Types
export type { TabInfo, TabContext } from './types'

// State management
export { getTabContext, getCurTab, setCurTabId, getTabListData, cleanupWindowContext } from './context'

// Tab lifecycle
export { createTabCore, createTabView, switchTab, closeTab, destroyAllTabViews, removeTabFromWindow, addTabToWindow } from './tabCore'

// Layout
export { updateCurTabBounds } from './tabBounds'

// DevTools
export { openDevToolsForTab, openDevToolsForCurTab } from './devTools'

// Window-Tab relationship
export { getTabEntry, getTabBrowserWindow, moveTabToWindow, cleanupWindowTabs } from './windowTabs'

// History
export { tabNavHistoryMap, pushHistory, goBackInHistory, goForwardInHistory, canGoBackInHistory, canGoForwardInHistory, removeNavHistory } from './history'
