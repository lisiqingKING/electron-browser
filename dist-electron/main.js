import { app, WebContentsView, ipcMain, BrowserWindow, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Database from "better-sqlite3";
function isUrl(input) {
  return /^(https?:\/\/|www\.)[^\s]+$/i.test(input);
}
const DB_PATH = path.join(app.getPath("userData"), "app.db");
let db = null;
function initTabsTable() {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
}
function initHistoryTable() {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabId TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      visitedAt INTEGER NOT NULL
    )
  `);
  getDatabase().exec(`
    CREATE INDEX IF NOT EXISTS idx_history_tabId ON history(tabId)
  `);
  getDatabase().exec(`
    CREATE INDEX IF NOT EXISTS idx_history_visitedAt ON history(visitedAt)
  `);
}
function initDatabase() {
  if (db) {
    return db;
  }
  db = new Database(DB_PATH);
  initTabsTable();
  initHistoryTable();
  console.log("[Database] Initialized at:", DB_PATH);
  return db;
}
function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log("[Database] Closed");
  }
}
function addHistory(tabId, title, url) {
  const stmt = getDatabase().prepare(
    "INSERT INTO history (tabId, title, url, visitedAt) VALUES (?, ?, ?, ?)"
  );
  stmt.run(tabId, title, url, Date.now());
}
function getAllHistory(limit = 100) {
  const stmt = getDatabase().prepare(
    "SELECT * FROM history ORDER BY visitedAt DESC LIMIT ?"
  );
  return stmt.all(limit);
}
const historyList = [];
function syncHistoryFromDb() {
  const records = getAllHistory();
  historyList.length = 0;
  historyList.push(...records);
}
function recordVisit(tabId, title, url) {
  addHistory(tabId, title, url);
  const record = {
    id: Date.now(),
    tabId,
    title,
    url,
    visitedAt: Date.now()
  };
  historyList.unshift(record);
}
function getHistory() {
  if (historyList.length === 0) {
    syncHistoryFromDb();
  }
  return [...historyList];
}
const DEFAULT_TAB = {
  title: "新建标签页",
  url: "default.html"
};
const tabs = [];
let curTabId;
const webContentViewMap = /* @__PURE__ */ new Map();
function createTab(tabInfo, win2) {
  const view = new WebContentsView({
    webPreferences: {
      preload: void 0,
      contextIsolation: true
    }
  });
  view.webContents.setWindowOpenHandler((event) => {
    console.log("[setWindowOpenHandler] 拦截到 window.open, url:", event.url);
    const curTab = getCurTab();
    if (curTab == null ? void 0 : curTab.view) {
      win2.contentView.removeChildView(curTab.view);
    }
    const popupView = createTab({
      url: event.url,
      title: "新窗口"
    }, win2);
    win2.contentView.addChildView(popupView);
    updateCurTabBounds(win2);
    win2.webContents.send("ipcMain:tabs:update");
    return { action: "deny" };
  });
  if (tabInfo.title !== "新建标签页") {
    view.webContents.once("page-title-updated", () => {
      console.log("123");
      const tab = getCurTab();
      if (!tab) return;
      tab.info.title = tab.view.webContents.getTitle();
      win2.webContents.send("tab:updated", tab.info);
    });
  }
  view.webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (isMainFrame) {
      const tab = webContentViewMap.get(_id);
      if (tab) {
        tab.info.url = url;
        recordVisit(_id, tab.info.title || url, url);
        win2.webContents.send("tab:url-changed", { id: _id, url });
        updateNavigationState(_id, win2);
      }
    }
  });
  view.webContents.on("did-navigate", (_event, url) => {
    const tab = webContentViewMap.get(_id);
    if (tab) {
      tab.info.url = url;
      recordVisit(_id, tab.info.title || url, url);
      updateNavigationState(_id, win2);
    }
  });
  if (isUrl(tabInfo.url)) {
    view.webContents.loadURL(tabInfo.url);
  } else {
    view.webContents.loadFile(tabInfo.url);
  }
  const _time = (/* @__PURE__ */ new Date()).getTime();
  const _id = "id" + _time;
  const _tabInfo = {
    ...tabInfo,
    time: _time,
    id: _id
  };
  tabs.push(_tabInfo);
  curTabId = _id;
  webContentViewMap.set(_id, {
    info: _tabInfo,
    view
  });
  return view;
}
function getCurTab() {
  return curTabId ? webContentViewMap.get(curTabId) : null;
}
function refreshCurTab() {
  const tab = getCurTab();
  tab == null ? void 0 : tab.view.webContents.reload();
}
function updateNavigationState(tabId, win2) {
  const tab = webContentViewMap.get(tabId);
  if (tab) {
    const canGoBack = tab.view.webContents.canGoBack();
    const canGoForward = tab.view.webContents.canGoForward();
    tab.info.canGoBack = canGoBack;
    tab.info.canGoForward = canGoForward;
    win2.webContents.send("tab:navigation-state", { id: tabId, canGoBack, canGoForward });
  }
}
function goBack(win2) {
  const tab = getCurTab();
  if (tab == null ? void 0 : tab.view.webContents.canGoBack()) {
    tab.view.webContents.goBack();
    if (curTabId) updateNavigationState(curTabId, win2);
  }
}
function goForward(win2) {
  const tab = getCurTab();
  if (tab == null ? void 0 : tab.view.webContents.canGoForward()) {
    tab.view.webContents.goForward();
    if (curTabId) updateNavigationState(curTabId, win2);
  }
}
function updateCurTabUrl(url, win2) {
  const tab = getCurTab();
  if (tab) {
    if (isUrl(url)) {
      tab.view.webContents.loadURL(url);
    } else {
      tab.view.webContents.loadFile(url);
    }
    tab.info.url = url;
    tab.view.webContents.once("page-title-updated", () => {
      tab.info.title = tab.view.webContents.getTitle();
      win2.webContents.send("tab:updated", tab.info);
    });
  }
}
function getTabInfoList() {
  return [...webContentViewMap.values()].map((item) => item.info);
}
function updateCurTabBounds(win2) {
  const tab = getCurTab();
  if (tab == null ? void 0 : tab.view) {
    const [width, height] = win2.getContentSize();
    tab.view.setBounds({
      x: 0,
      y: 80,
      width,
      height: height - 80
    });
  }
}
function switchTab(id, win2) {
  if (!webContentViewMap.has(id)) return false;
  const curTab = getCurTab();
  if (curTab == null ? void 0 : curTab.view) {
    win2.contentView.removeChildView(curTab.view);
  }
  curTabId = id;
  const targetTab = webContentViewMap.get(id);
  win2.contentView.addChildView(targetTab.view);
  updateCurTabBounds(win2);
  return true;
}
function closeTab(id, win2) {
  if (!webContentViewMap.has(id)) return false;
  const tab = webContentViewMap.get(id);
  win2.contentView.removeChildView(tab.view);
  webContentViewMap.delete(id);
  tabs.splice(tabs.findIndex((t) => t.id === id), 1);
  if (curTabId === id) {
    const firstTab = webContentViewMap.values().next().value;
    if (firstTab) {
      switchTab(firstTab.info.id, win2);
    } else {
      curTabId = null;
    }
  }
  return true;
}
function registerTabHandlers(win2) {
  ipcMain.handle("tabs:list", async () => {
    return getTabInfoList();
  });
  ipcMain.handle("tabs:create", async (_event, tabInfo) => {
    const tab = getCurTab();
    if (tab == null ? void 0 : tab.view) {
      win2.contentView.removeChildView(tab.view);
    }
    const _view = createTab(tabInfo, win2);
    win2.contentView.addChildView(_view);
    updateCurTabBounds(win2);
    return true;
  });
  ipcMain.handle("tabs:createDefault", async () => {
    const tab = getCurTab();
    if (tab == null ? void 0 : tab.view) {
      win2.contentView.removeChildView(tab.view);
    }
    const _view = createTab({
      title: DEFAULT_TAB.title,
      url: path.join(process.env.APP_ROOT, DEFAULT_TAB.url)
    }, win2);
    win2.contentView.addChildView(_view);
    updateCurTabBounds(win2);
    return true;
  });
  ipcMain.on("tabs:refresh", () => {
    refreshCurTab();
  });
  ipcMain.on("tabs:updateUrl", (_event, url) => {
    updateCurTabUrl(url, win2);
    updateCurTabBounds(win2);
  });
  ipcMain.handle("tabs:switch", async (_event, tabId) => {
    return switchTab(tabId, win2);
  });
  ipcMain.handle("tabs:close", async (_event, tabId) => {
    return closeTab(tabId, win2);
  });
  ipcMain.on("tabs:goBack", () => {
    goBack(win2);
  });
  ipcMain.on("tabs:goForward", () => {
    goForward(win2);
  });
  ipcMain.handle("history:get", async () => {
    return getHistory();
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  const webContentView = createTab({
    title: "新建标签页",
    url: path.join(process.env.APP_ROOT, "default.html")
  }, win);
  win.contentView.addChildView(webContentView);
  win.on("resize", () => updateCurTabBounds(win));
  updateCurTabBounds(win);
  registerTabHandlers(win);
  win.webContents.openDevTools();
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("will-quit", () => {
  closeDatabase();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  initDatabase();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
