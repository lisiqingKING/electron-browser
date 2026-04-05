import { WebContentsView, ipcMain, app, BrowserWindow, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
function isUrl(input) {
  return /^(https?:\/\/|www\.)[^\s]+$/i.test(input);
}
const DEFAULT_TAB = {
  title: "新建标签页",
  url: "default.html"
};
const tabs = [];
let curTabId;
const webContentViewMap = /* @__PURE__ */ new Map();
function createTab(tabInfo, win) {
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
      win.contentView.removeChildView(curTab.view);
    }
    const popupView = createTab({
      url: event.url,
      title: "新窗口"
    }, win);
    win.contentView.addChildView(popupView);
    updateCurTabBounds(win);
    win.webContents.send("ipcMain:tabs:update");
    return { action: "deny" };
  });
  if (tabInfo.title !== "新建标签页") {
    view.webContents.once("page-title-updated", () => {
      console.log("123");
      const tab = getCurTab();
      if (!tab) return;
      tab.info.title = tab.view.webContents.getTitle();
      win.webContents.send("tab:updated", tab.info);
    });
  }
  view.webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (isMainFrame) {
      const tab = webContentViewMap.get(_id);
      if (tab) {
        tab.info.url = url;
        win.webContents.send("tab:url-changed", { id: _id, url });
        updateNavigationState(_id, win);
      }
    }
  });
  view.webContents.on("did-navigate", (_event, url) => {
    const tab = webContentViewMap.get(_id);
    if (tab) {
      tab.info.url = url;
      updateNavigationState(_id, win);
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
function updateNavigationState(tabId, win) {
  const tab = webContentViewMap.get(tabId);
  if (tab) {
    const canGoBack = tab.view.webContents.canGoBack();
    const canGoForward = tab.view.webContents.canGoForward();
    tab.info.canGoBack = canGoBack;
    tab.info.canGoForward = canGoForward;
    win.webContents.send("tab:navigation-state", { id: tabId, canGoBack, canGoForward });
  }
}
function goBack(win) {
  const tab = getCurTab();
  if (tab == null ? void 0 : tab.view.webContents.canGoBack()) {
    tab.view.webContents.goBack();
    if (curTabId) updateNavigationState(curTabId, win);
  }
}
function goForward(win) {
  const tab = getCurTab();
  if (tab == null ? void 0 : tab.view.webContents.canGoForward()) {
    tab.view.webContents.goForward();
    if (curTabId) updateNavigationState(curTabId, win);
  }
}
function updateCurTabUrl(url, win) {
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
      win.webContents.send("tab:updated", tab.info);
    });
  }
}
function getTabInfoList() {
  return [...webContentViewMap.values()].map((item) => item.info);
}
function updateCurTabBounds(win) {
  const tab = getCurTab();
  if (tab == null ? void 0 : tab.view) {
    const [width, height] = win.getContentSize();
    tab.view.setBounds({
      x: 0,
      y: 80,
      width,
      height: height - 80
    });
  }
}
function switchTab(id, win) {
  if (!webContentViewMap.has(id)) return false;
  const curTab = getCurTab();
  if (curTab == null ? void 0 : curTab.view) {
    win.contentView.removeChildView(curTab.view);
  }
  curTabId = id;
  const targetTab = webContentViewMap.get(id);
  win.contentView.addChildView(targetTab.view);
  updateCurTabBounds(win);
  return true;
}
function closeTab(id, win) {
  if (!webContentViewMap.has(id)) return false;
  const tab = webContentViewMap.get(id);
  win.contentView.removeChildView(tab.view);
  webContentViewMap.delete(id);
  tabs.splice(tabs.findIndex((t) => t.id === id), 1);
  if (curTabId === id) {
    const firstTab = webContentViewMap.values().next().value;
    if (firstTab) {
      switchTab(firstTab.info.id, win);
    } else {
      curTabId = null;
    }
  }
  return true;
}
function registerTabHandlers(win) {
  ipcMain.handle("tabs:list", async () => {
    return getTabInfoList();
  });
  ipcMain.handle("tabs:create", async (_event, tabInfo) => {
    const tab = getCurTab();
    if (tab == null ? void 0 : tab.view) {
      win.contentView.removeChildView(tab.view);
    }
    const _view = createTab(tabInfo, win);
    win.contentView.addChildView(_view);
    updateCurTabBounds(win);
    return true;
  });
  ipcMain.handle("tabs:createDefault", async () => {
    const tab = getCurTab();
    if (tab == null ? void 0 : tab.view) {
      win.contentView.removeChildView(tab.view);
    }
    const _view = createTab({
      title: DEFAULT_TAB.title,
      url: path.join(process.env.APP_ROOT, DEFAULT_TAB.url)
    }, win);
    win.contentView.addChildView(_view);
    updateCurTabBounds(win);
    return true;
  });
  ipcMain.on("tabs:refresh", () => {
    refreshCurTab();
  });
  ipcMain.on("tabs:updateUrl", (_event, url) => {
    updateCurTabUrl(url, win);
    updateCurTabBounds(win);
  });
  ipcMain.handle("tabs:switch", async (_event, tabId) => {
    return switchTab(tabId, win);
  });
  ipcMain.handle("tabs:close", async (_event, tabId) => {
    return closeTab(tabId, win);
  });
  ipcMain.on("tabs:goBack", () => {
    goBack(win);
  });
  ipcMain.on("tabs:goForward", () => {
    goForward(win);
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win$1;
function createWindow() {
  Menu.setApplicationMenu(null);
  win$1 = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    }
  });
  win$1.webContents.on("did-finish-load", () => {
    win$1 == null ? void 0 : win$1.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win$1.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win$1.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  const webContentView = createTab({
    title: "新建标签页",
    url: path.join(process.env.APP_ROOT, "default.html")
  }, win$1);
  win$1.contentView.addChildView(webContentView);
  win$1.on("resize", () => updateCurTabBounds(win$1));
  updateCurTabBounds(win$1);
  registerTabHandlers(win$1);
  win$1.webContents.openDevTools();
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
