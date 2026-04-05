import { WebContentsView, app, ipcMain, BrowserWindow, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Database from "better-sqlite3";
const __dirname$2 = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TAB = {
  title: "新建标签页",
  url: "default.html"
};
const tabs = [];
let curTabId;
const webContentViewMap = /* @__PURE__ */ new Map();
function getCurTab() {
  return curTabId ? webContentViewMap.get(curTabId) : null;
}
function setCurTabId(id) {
  curTabId = id;
}
function createTabCore(tabInfo) {
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname$2, "preload.mjs"),
      contextIsolation: true
    }
  });
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
  return { view, tabInfo: _tabInfo };
}
function isLocalFile(url) {
  return !url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("www.");
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
  updateCurTabBounds(targetTab, win2);
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
function updateCurTabBounds(tab, win2) {
  const [width, height] = win2.getContentSize();
  tab.view.setBounds({
    x: 0,
    y: 80,
    width,
    height: height - 80
  });
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
  getDatabase().exec("DROP TABLE IF EXISTS history");
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS history (
      data TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    )
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
function getAllHistory() {
  const stmt = getDatabase().prepare("SELECT data FROM history LIMIT 1");
  const row = stmt.get();
  if (!row) return [];
  return JSON.parse(row.data);
}
function saveHistory(data) {
  getDatabase().exec("DELETE FROM history");
  const stmt = getDatabase().prepare("INSERT INTO history (data, updatedAt) VALUES (?, ?)");
  stmt.run(JSON.stringify(data), Date.now());
}
function clearAll() {
  getDatabase().exec("DELETE FROM history");
}
const historyCache = [];
function syncFromDb() {
  historyCache.length = 0;
  const records = getAllHistory();
  historyCache.push(...records);
}
function getHistory() {
  if (historyCache.length === 0) {
    syncFromDb();
  }
  return [...historyCache];
}
function recordVisit(title, url) {
  historyCache.unshift({
    title,
    url,
    visitedAt: Date.now()
  });
  if (historyCache.length > 100) {
    historyCache.length = 100;
  }
  saveHistory(historyCache);
}
function deleteRecord(url, visitedAt) {
  const index = historyCache.findIndex(
    (item) => item.url === url && item.visitedAt === visitedAt
  );
  if (index !== -1) {
    historyCache.splice(index, 1);
    saveHistory(historyCache);
  }
}
function clearAllHistory() {
  historyCache.length = 0;
  clearAll();
}
function isUrl(input) {
  return /^(https?:\/\/|www\.)[^\s]+$/i.test(input);
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
    const handler = (_event, title) => {
      tab.view.webContents.removeListener("page-title-updated", handler);
      updateTabInfo(tab.info.id, win2, title);
    };
    tab.view.webContents.on("page-title-updated", handler);
    tab.view.webContents.goBack();
  }
}
function goForward(win2) {
  const tab = getCurTab();
  if (tab == null ? void 0 : tab.view.webContents.canGoForward()) {
    const handler = (_event, title) => {
      tab.view.webContents.removeListener("page-title-updated", handler);
      updateTabInfo(tab.info.id, win2, title);
    };
    tab.view.webContents.on("page-title-updated", handler);
    tab.view.webContents.goForward();
  }
}
function isDefaultPageUrl$1(url) {
  return url.includes("default.html") || url.endsWith("/default.html");
}
function getTitleForUrl$1(tab, pageTitle) {
  if (isDefaultPageUrl$1(tab.info.url)) {
    return "新建标签页";
  }
  return pageTitle || tab.view.webContents.getTitle();
}
function updateTabInfo(tabId, win2, title) {
  const tab = webContentViewMap.get(tabId);
  if (tab) {
    const newUrl = tab.view.webContents.getURL();
    tab.info.url = newUrl;
    tab.info.title = getTitleForUrl$1(tab, title || tab.view.webContents.getTitle());
    updateNavigationState(tabId, win2);
    win2.webContents.send("tab:updated", tab.info);
    if (!isLocalFile(newUrl)) {
      win2.webContents.send("tab:url-changed", { id: tabId, url: newUrl });
    }
  }
}
function refreshCurTab(win2) {
  const tab = getCurTab();
  if (tab) {
    tab.view.webContents.once("did-finish-load", () => {
      if (tab.info.id) {
        const newUrl = tab.view.webContents.getURL();
        tab.info.url = newUrl;
        tab.info.title = getTitleForUrl$1(tab);
        win2.webContents.send("tab:updated", tab.info);
        if (!isLocalFile(newUrl)) {
          win2.webContents.send("tab:url-changed", { id: tab.info.id, url: newUrl });
        }
      }
    });
    tab.view.webContents.reload();
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
function createTabAndShow(tabInfo, win2) {
  const curTab = getCurTab();
  if (curTab == null ? void 0 : curTab.view) {
    win2.contentView.removeChildView(curTab.view);
  }
  const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo);
  if (isUrl(tabInfo.url)) {
    view.webContents.loadURL(tabInfo.url);
  } else {
    view.webContents.loadFile(tabInfo.url);
  }
  registerWebContentsEvents(view, enrichedTabInfo, win2);
  win2.contentView.addChildView(view);
  updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id), win2);
  win2.webContents.send("ipcMain:tabs:update");
  return view;
}
function isDefaultPageUrl(url) {
  return url.includes("default.html");
}
function getTitleForUrl(tab, pageTitle) {
  if (isDefaultPageUrl(tab.info.url)) {
    return "新建标签页";
  }
  return pageTitle;
}
function registerWebContentsEvents(view, tabInfo, win2) {
  const tabId = tabInfo.id;
  view.webContents.setWindowOpenHandler((event) => {
    console.log("[setWindowOpenHandler] 拦截到 window.open, url:", event.url);
    const curTab = getCurTab();
    if (curTab == null ? void 0 : curTab.view) {
      win2.contentView.removeChildView(curTab.view);
    }
    const { view: newView, tabInfo: newTabInfo } = createTabCore({ url: event.url, title: "新窗口" });
    if (isUrl(event.url)) {
      newView.webContents.loadURL(event.url);
    } else {
      newView.webContents.loadFile(event.url);
    }
    registerWebContentsEvents(newView, newTabInfo, win2);
    win2.contentView.addChildView(newView);
    updateCurTabBounds(webContentViewMap.get(newTabInfo.id), win2);
    win2.webContents.send("ipcMain:tabs:update");
    return { action: "deny" };
  });
  view.webContents.on("did-start-loading", () => {
    const tab = webContentViewMap.get(tabId);
    if (tab) {
      tab.info.isLoading = true;
      win2.webContents.send("tab:loading", { id: tabId, isLoading: true });
    }
  });
  view.webContents.on("did-stop-loading", () => {
    const tab = webContentViewMap.get(tabId);
    if (tab) {
      tab.info.isLoading = false;
      win2.webContents.send("tab:loading", { id: tabId, isLoading: false });
    }
  });
  view.webContents.on("did-finish-load", () => {
    const tab = webContentViewMap.get(tabId);
    if (tab && !tab.info.url.includes("history.html") && !tab.info.url.includes("default.html")) {
      const newUrl = view.webContents.getURL();
      const title = getTitleForUrl(tab, view.webContents.getTitle() || tab.info.title);
      tab.info.url = newUrl;
      tab.info.title = title;
      recordVisit(title, newUrl);
      win2.webContents.send("tab:updated", tab.info);
      updateNavigationState(tabId, win2);
    }
  });
  view.webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (isMainFrame) {
      const tab = webContentViewMap.get(tabId);
      if (tab) {
        tab.info.url = url;
        win2.webContents.send("tab:url-changed", { id: tabId, url });
        updateNavigationState(tabId, win2);
      }
    }
  });
  view.webContents.on("did-navigate", (_event, url) => {
    const tab = webContentViewMap.get(tabId);
    if (tab) {
      tab.info.url = url;
      tab.info.title = getTitleForUrl(tab, view.webContents.getTitle());
      if (!isLocalFile(url)) {
        win2.webContents.send("tab:url-changed", { id: tabId, url });
      }
      win2.webContents.send("tab:updated", tab.info);
      updateNavigationState(tabId, win2);
    }
  });
  view.webContents.on("page-title-updated", (_event, title) => {
    const tab = webContentViewMap.get(tabId);
    if (tab) {
      const newTitle = getTitleForUrl(tab, title);
      if (newTitle !== tab.info.title) {
        tab.info.title = newTitle;
        win2.webContents.send("tab:updated", tab.info);
      }
    }
  });
}
function registerTabHandlers(win2) {
  ipcMain.handle("tabs:list", async () => {
    return [...webContentViewMap.values()].map((item) => item.info);
  });
  ipcMain.handle("tabs:create", async (_event, tabInfo) => {
    const curTab = getCurTab();
    if (curTab == null ? void 0 : curTab.view) {
      win2.contentView.removeChildView(curTab.view);
    }
    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo);
    registerWebContentsEvents(view, enrichedTabInfo, win2);
    if (tabInfo.url.startsWith("http")) {
      view.webContents.loadURL(tabInfo.url);
    } else {
      view.webContents.loadFile(tabInfo.url);
    }
    win2.contentView.addChildView(view);
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id), win2);
    win2.webContents.send("ipcMain:tabs:update");
    return true;
  });
  ipcMain.handle("tabs:createDefault", async () => {
    const curTab = getCurTab();
    if (curTab == null ? void 0 : curTab.view) {
      win2.contentView.removeChildView(curTab.view);
    }
    const tabInfo = {
      title: DEFAULT_TAB.title,
      url: path.join(process.env.APP_ROOT, DEFAULT_TAB.url)
    };
    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo);
    registerWebContentsEvents(view, enrichedTabInfo, win2);
    view.webContents.loadFile(tabInfo.url);
    win2.contentView.addChildView(view);
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id), win2);
    return true;
  });
  ipcMain.handle("tabs:createHistory", async () => {
    const curTab = getCurTab();
    if (curTab == null ? void 0 : curTab.view) {
      win2.contentView.removeChildView(curTab.view);
    }
    const tabInfo = {
      title: "历史记录",
      url: path.join(process.env.APP_ROOT, "history.html")
    };
    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo);
    registerWebContentsEvents(view, enrichedTabInfo, win2);
    view.webContents.loadFile(tabInfo.url);
    win2.contentView.addChildView(view);
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id), win2);
    return true;
  });
  ipcMain.on("tabs:refresh", () => {
    refreshCurTab(win2);
  });
  ipcMain.on("tabs:updateUrl", (_event, url) => {
    var _a;
    updateCurTabUrl(url, win2);
    updateCurTabBounds(webContentViewMap.get((_a = getCurTab()) == null ? void 0 : _a.info.id), win2);
  });
  ipcMain.handle("tabs:switch", async (_event, tabId) => {
    const curTab = getCurTab();
    if (curTab == null ? void 0 : curTab.view) {
      win2.contentView.removeChildView(curTab.view);
    }
    const targetTab = webContentViewMap.get(tabId);
    if (targetTab) {
      win2.contentView.addChildView(targetTab.view);
      updateCurTabBounds(targetTab, win2);
      setCurTabId(tabId);
    }
    return true;
  });
  ipcMain.handle("tabs:close", async (_event, tabId) => {
    closeTab(tabId, win2);
    win2.webContents.send("ipcMain:tabs:update");
    return true;
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
  ipcMain.handle("history:clear", async () => {
    clearAllHistory();
    return true;
  });
  ipcMain.handle("history:delete", async (_event, url, visitedAt) => {
    deleteRecord(url, visitedAt);
    return true;
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
  createTabAndShow({
    title: "新建标签页",
    url: path.join(process.env.APP_ROOT, "default.html")
  }, win);
  win.on("resize", () => {
    const curTab = getCurTab();
    if (curTab) updateCurTabBounds(curTab, win);
  });
  registerTabHandlers(win);
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }
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
