import { WebContentsView, shell, ipcMain, app, BrowserWindow, Menu } from "electron";
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
function createTab(tabInfo) {
  const view = new WebContentsView({
    webPreferences: {
      preload: void 0,
      contextIsolation: true
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
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
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
    const _view = createTab(tabInfo);
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
    });
    win2.contentView.addChildView(_view);
    updateCurTabBounds(win2);
    return true;
  });
  ipcMain.on("tabs:refresh", () => {
    refreshCurTab();
  });
  ipcMain.handle("tabs:switch", async (_event, tabId) => {
    return switchTab(tabId, win2);
  });
  ipcMain.handle("tabs:close", async (_event, tabId) => {
    return closeTab(tabId, win2);
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
  });
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
