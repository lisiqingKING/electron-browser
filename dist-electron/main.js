import { app as h, WebContentsView as F, ipcMain as c, BrowserWindow as V, Menu as S } from "electron";
import { fileURLToPath as I } from "node:url";
import a from "node:path";
import B from "better-sqlite3";
const y = a.join(h.getPath("userData"), "app.db");
let w = null;
function x() {
  b().exec(`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
}
function H() {
  b().exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabId TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      visitedAt INTEGER NOT NULL
    )
  `), b().exec(`
    CREATE INDEX IF NOT EXISTS idx_history_tabId ON history(tabId)
  `), b().exec(`
    CREATE INDEX IF NOT EXISTS idx_history_visitedAt ON history(visitedAt)
  `);
}
function A() {
  return w || (w = new B(y), x(), H(), console.log("[Database] Initialized at:", y), w);
}
function b() {
  return w || A();
}
function M() {
  w && (w.close(), w = null, console.log("[Database] Closed"));
}
function j(e, t, n) {
  b().prepare(
    "INSERT INTO history (tabId, title, url, visitedAt) VALUES (?, ?, ?, ?)"
  ).run(e, t, n, Date.now());
}
function G(e = 100) {
  return b().prepare(
    "SELECT * FROM history ORDER BY visitedAt DESC LIMIT ?"
  ).all(e);
}
function X(e) {
  b().prepare("DELETE FROM history WHERE id = ?").run(e);
}
function k() {
  b().exec("DELETE FROM history");
}
const p = [];
function W() {
  const e = G();
  p.length = 0, p.push(...e);
}
function Y(e, t, n) {
  j(e, t, n);
  const o = {
    id: Date.now(),
    tabId: e,
    title: t,
    url: n,
    visitedAt: Date.now()
  };
  p.unshift(o);
}
function $() {
  return p.length === 0 && W(), [...p];
}
function z() {
  k(), p.length = 0;
}
function q(e) {
  X(e);
  const t = p.findIndex((n) => n.id === e);
  t !== -1 && p.splice(t, 1);
}
function O(e) {
  return /^(https?:\/\/|www\.)[^\s]+$/i.test(e);
}
const K = a.dirname(I(import.meta.url)), L = {
  title: "新建标签页",
  url: "default.html"
}, m = [];
let u;
const l = /* @__PURE__ */ new Map();
function E(e, t) {
  const n = new F({
    webPreferences: {
      preload: a.join(K, "preload.mjs"),
      contextIsolation: !0
    }
  });
  n.webContents.setWindowOpenHandler((i) => {
    console.log("[setWindowOpenHandler] 拦截到 window.open, url:", i.url);
    const f = d();
    f != null && f.view && t.contentView.removeChildView(f.view);
    const v = E({
      url: i.url,
      title: "新窗口"
    }, t);
    return t.contentView.addChildView(v), T(t), t.webContents.send("ipcMain:tabs:update"), { action: "deny" };
  }), e.title !== "新建标签页" && n.webContents.once("page-title-updated", () => {
    console.log("123");
    const i = d();
    i && (i.info.title = i.view.webContents.getTitle(), t.webContents.send("tab:updated", i.info));
  }), n.webContents.on("did-navigate-in-page", (i, f, v) => {
    if (v) {
      const _ = l.get(s);
      _ && (_.info.url = f, t.webContents.send("tab:url-changed", { id: s, url: f }), g(s, t));
    }
  }), n.webContents.on("did-navigate", (i, f) => {
    const v = l.get(s);
    v && (v.info.url = f, g(s, t));
  }), n.webContents.on("did-finish-load", () => {
    const i = l.get(s);
    i && !i.info.url.includes("default.html") && !i.info.url.includes("history.html") && Y(s, i.info.title || i.info.url, i.info.url);
  }), O(e.url) ? n.webContents.loadURL(e.url) : n.webContents.loadFile(e.url);
  const o = (/* @__PURE__ */ new Date()).getTime(), s = "id" + o, R = {
    ...e,
    time: o,
    id: s
  };
  return m.push(R), u = s, l.set(s, {
    info: R,
    view: n
  }), n;
}
function d() {
  return u ? l.get(u) : null;
}
function J() {
  const e = d();
  e == null || e.view.webContents.reload();
}
function g(e, t) {
  const n = l.get(e);
  if (n) {
    const o = n.view.webContents.canGoBack(), s = n.view.webContents.canGoForward();
    n.info.canGoBack = o, n.info.canGoForward = s, t.webContents.send("tab:navigation-state", { id: e, canGoBack: o, canGoForward: s });
  }
}
function Q(e) {
  const t = d();
  t != null && t.view.webContents.canGoBack() && (t.view.webContents.goBack(), u && g(u, e));
}
function Z(e) {
  const t = d();
  t != null && t.view.webContents.canGoForward() && (t.view.webContents.goForward(), u && g(u, e));
}
function ee(e, t) {
  const n = d();
  n && (O(e) ? n.view.webContents.loadURL(e) : n.view.webContents.loadFile(e), n.info.url = e, n.view.webContents.once("page-title-updated", () => {
    n.info.title = n.view.webContents.getTitle(), t.webContents.send("tab:updated", n.info);
  }));
}
function te() {
  return [...l.values()].map((e) => e.info);
}
function T(e) {
  const t = d();
  if (t != null && t.view) {
    const [n, o] = e.getContentSize();
    t.view.setBounds({
      x: 0,
      y: 80,
      width: n,
      height: o - 80
    });
  }
}
function N(e, t) {
  if (!l.has(e)) return !1;
  const n = d();
  n != null && n.view && t.contentView.removeChildView(n.view), u = e;
  const o = l.get(e);
  return t.contentView.addChildView(o.view), T(t), !0;
}
function ne(e, t) {
  if (!l.has(e)) return !1;
  const n = l.get(e);
  if (t.contentView.removeChildView(n.view), l.delete(e), m.splice(m.findIndex((o) => o.id === e), 1), u === e) {
    const o = l.values().next().value;
    o ? N(o.info.id, t) : u = null;
  }
  return !0;
}
function oe(e) {
  c.handle("tabs:list", async () => te()), c.handle("tabs:create", async (t, n) => {
    const o = d();
    o != null && o.view && e.contentView.removeChildView(o.view);
    const s = E(n, e);
    return e.contentView.addChildView(s), T(e), e.webContents.send("ipcMain:tabs:update"), !0;
  }), c.handle("tabs:createDefault", async () => {
    const t = d();
    t != null && t.view && e.contentView.removeChildView(t.view);
    const n = E({
      title: L.title,
      url: a.join(process.env.APP_ROOT, L.url)
    }, e);
    return e.contentView.addChildView(n), T(e), !0;
  }), c.handle("tabs:createHistory", async () => {
    const t = d();
    t != null && t.view && e.contentView.removeChildView(t.view);
    const n = E({
      title: "历史记录",
      url: a.join(process.env.APP_ROOT, "history.html")
    }, e);
    return e.contentView.addChildView(n), T(e), !0;
  }), c.on("tabs:refresh", () => {
    J();
  }), c.on("tabs:updateUrl", (t, n) => {
    ee(n, e), T(e);
  }), c.handle("tabs:switch", async (t, n) => N(n, e)), c.handle("tabs:close", async (t, n) => ne(n, e)), c.on("tabs:goBack", () => {
    Q(e);
  }), c.on("tabs:goForward", () => {
    Z(e);
  }), c.handle("history:get", async () => $()), c.handle("history:clear", async () => (z(), !0)), c.handle("history:delete", async (t, n) => (q(n), !0));
}
const D = a.dirname(I(import.meta.url));
process.env.APP_ROOT = a.join(D, "..");
const C = process.env.VITE_DEV_SERVER_URL, ce = a.join(process.env.APP_ROOT, "dist-electron"), U = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = C ? a.join(process.env.APP_ROOT, "public") : U;
let r;
function P() {
  S.setApplicationMenu(null), r = new V({
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(D, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webviewTag: !0
    }
  }), r.webContents.on("did-finish-load", () => {
    r == null || r.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), C ? r.loadURL(C) : r.loadFile(a.join(U, "index.html"));
  const e = E({
    title: "新建标签页",
    url: a.join(process.env.APP_ROOT, "default.html")
  }, r);
  r.contentView.addChildView(e), r.on("resize", () => T(r)), T(r), oe(r), C && r.webContents.openDevTools();
}
h.on("window-all-closed", () => {
  process.platform !== "darwin" && h.quit();
});
h.on("will-quit", () => {
  M();
});
h.on("activate", () => {
  V.getAllWindows().length === 0 && P();
});
h.whenReady().then(() => {
  A(), P();
});
export {
  ce as MAIN_DIST,
  U as RENDERER_DIST,
  C as VITE_DEV_SERVER_URL
};
