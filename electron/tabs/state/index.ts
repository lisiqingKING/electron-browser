// Types
export type { TabInfo, TabContext } from './types'

// State management
export { getTabContext, getCurTab, setCurTabId, getTabListData, cleanupWindowContext } from './context'

// Tab lifecycle
export { createTabCore, createTabView, switchTab, closeTab } from './tabCore'

// Layout
export { updateCurTabBounds } from './tabBounds'

// DevTools
export { openDevToolsForTab, openDevToolsForCurTab } from './devTools'

// Registry
export { registerTab, unregisterTab, getTabEntry, moveTabToWindow, cleanupWindowTabs } from './registry'

// History
export { tabNavHistoryMap, pushHistory, goBackInHistory, goForwardInHistory, canGoBackInHistory, canGoForwardInHistory, removeNavHistory } from './history'
