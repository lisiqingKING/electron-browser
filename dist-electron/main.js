import { app as b, WebContentsView as J, Menu as H, ipcMain as d, BrowserWindow as G, protocol as _ } from "electron";
import { fileURLToPath as j } from "node:url";
import c from "node:path";
import Q from "better-sqlite3";
import N from "node:http";
import x from "node:fs";
const R = {
  getAppUrl() {
    return b.isPackaged ? "lsqapp://internal-app" : "http://localhost:5273/#/";
  },
  getHistoryUrl() {
    return b.isPackaged ? "lsqapp://internal-app/history" : "http://localhost:5273/#/history";
  }
}, S = c.dirname(j(import.meta.url)), Z = /* @__PURE__ */ new Map();
function ee(e) {
  Z.delete(e);
}
const te = {
  title: "新建标签页"
}, L = [];
let C;
const r = /* @__PURE__ */ new Map();
function p() {
  return C ? r.get(C) : null;
}
function ne(e) {
  C = e;
}
function m(e) {
  const n = !!process.env.VITE_DEV_SERVER_URL ? c.join(S, "..", "dist-electron", "preload-app.mjs") : c.join(S, "preload-app.mjs"), i = new J({
    webPreferences: {
      preload: n,
      contextIsolation: !0
    }
  }), o = (/* @__PURE__ */ new Date()).getTime(), s = "id" + o, a = {
    ...e,
    time: o,
    id: s
  };
  return L.push(a), C = s, r.set(s, {
    info: a,
    view: i
  }), { view: i, tabInfo: a };
}
function oe(e, t) {
  if (!r.has(e)) return !1;
  const n = p();
  n != null && n.view && t.contentView.removeChildView(n.view), C = e;
  const i = r.get(e);
  return t.contentView.addChildView(i.view), f(i, t), !0;
}
function ie(e, t) {
  if (!r.has(e)) return null;
  const n = r.get(e);
  t.contentView.removeChildView(n.view), r.delete(e);
  const i = L.findIndex((s) => s.id === e);
  L.splice(i, 1), ee(e);
  let o = null;
  if (C === e) {
    const s = i > 0 ? i - 1 : 0, a = L[s];
    a != null && a.id ? (oe(a.id, t), o = a.id) : C = null;
  }
  return o;
}
function f(e, t) {
  const [n, i] = t.getContentSize();
  e.view.setBounds({
    x: 0,
    y: 110,
    width: n,
    height: i - 110
  });
}
function se() {
  const e = p();
  e && e.view.webContents.openDevTools();
}
const O = c.join(b.getPath("userData"), "app.db");
let w = null;
function ae() {
  T().exec(`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
}
function re() {
  T().exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      visitedAt INTEGER NOT NULL
    )
  `);
}
function k() {
  return w || (w = new Q(O), ae(), re(), console.log("[Database] Initialized at:", O), w);
}
function T() {
  return w || k();
}
function le() {
  w && (w.close(), w = null, console.log("[Database] Closed"));
}
function ce() {
  return T().prepare("SELECT id, title, url, visitedAt FROM history ORDER BY visitedAt DESC").all();
}
function de(e) {
  return T().prepare("INSERT INTO history (title, url, visitedAt) VALUES (?, ?, ?)").run(e.title, e.url, e.visitedAt).lastInsertRowid;
}
function pe(e) {
  T().prepare("DELETE FROM history WHERE id = ?").run(e);
}
function ue() {
  T().exec("DELETE FROM history");
}
function fe(e) {
  T().exec(`DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY visitedAt DESC LIMIT ${e})`);
}
const u = [];
function we() {
  u.length = 0;
  const e = ce();
  u.push(...e);
}
function be() {
  return u.length === 0 && we(), [...u];
}
function P(e, t) {
  const n = Date.now(), i = de({ title: e, url: t, visitedAt: n });
  u.unshift({ id: i, title: e, url: t, visitedAt: n }), u.length > 100 && (u.splice(100), fe(100));
}
function ge(e) {
  const t = u.findIndex((n) => n.id === e);
  t !== -1 && (u.splice(t, 1), pe(e));
}
function he() {
  u.length = 0, ue();
}
function D(e) {
  return /^(https?:\/\/|www\.|lsqapp:\/\/|open-lsqapp:\/\/)[^\s]+$/i.test(e);
}
function E(e, t) {
  const n = r.get(e);
  if (n) {
    const i = n.view.webContents.canGoBack(), o = n.view.webContents.canGoForward();
    n.info.canGoBack = i, n.info.canGoForward = o, console.log("[updateNavigationState] sending tab:can-navigate", { id: e, canGoBack: i, canGoForward: o }), t.webContents.send("tab:can-navigate", { id: e, canGoBack: i, canGoForward: o });
  }
}
function ve(e) {
  const t = p();
  if (!t) {
    console.log("[goBack] no current tab");
    return;
  }
  const n = t.view.webContents.canGoBack();
  if (console.log("[goBack] canGoBack:", n), !n) {
    console.log("[goBack] no back history in browser");
    return;
  }
  const i = () => {
    console.log("[goBack] navigation finished, newUrl:", t.view.webContents.getURL()), t.info.url = t.view.webContents.getURL(), t.info.actualUrl = t.info.url, e.webContents.send("tab:info-changed", t.info), E(t.info.id, e);
  };
  t.view.webContents.once("did-navigate", i), t.view.webContents.once("did-navigate-in-page", i), t.view.webContents.goBack();
}
function Ce(e) {
  const t = p();
  if (!t) {
    console.log("[goForward] no current tab");
    return;
  }
  const n = t.view.webContents.canGoForward();
  if (console.log("[goForward] canGoForward:", n), !n) {
    console.log("[goForward] no forward history in browser");
    return;
  }
  const i = () => {
    console.log("[goForward] navigation finished, newUrl:", t.view.webContents.getURL()), t.info.url = t.view.webContents.getURL(), t.info.actualUrl = t.info.url, e.webContents.send("tab:info-changed", t.info), E(t.info.id, e);
  };
  t.view.webContents.once("did-navigate", i), t.view.webContents.once("did-navigate-in-page", i), t.view.webContents.goForward();
}
function Te(e) {
  const t = R.getAppUrl();
  return e.includes(t) || e.includes("localhost") || e.includes("../app/index.html");
}
function me(e, t) {
  return Te(e.info.url) ? "新建标签页" : t || e.view.webContents.getTitle();
}
function Ee(e) {
  const t = p();
  t && (t.view.webContents.once("did-finish-load", () => {
    if (t.info.id) {
      const n = t.view.webContents.getURL();
      t.info.url.startsWith("lsqapp://") ? t.info.actualUrl = n : (t.info.url = n, t.info.title = me(t)), e.webContents.send("tab:info-changed", t.info);
    }
  }), t.view.webContents.reload());
}
function Ue(e, t) {
  const n = p();
  n && (D(e) ? n.view.webContents.loadURL(e) : n.view.webContents.loadFile(e), n.info.url = e, n.view.webContents.once("page-title-updated", () => {
    n.info.title = n.view.webContents.getTitle(), t.webContents.send("tab:info-changed", n.info);
  }));
}
function Re(e, t) {
  const n = p();
  n != null && n.view && t.contentView.removeChildView(n.view);
  const { view: i, tabInfo: o } = m(e);
  return D(e.url) ? i.webContents.loadURL(e.url) : i.webContents.loadFile(e.url), U(i, o, t), t.contentView.addChildView(i), f(r.get(o.id), t), t.webContents.send("tab:list-changed"), i;
}
function $(e) {
  const t = R.getAppUrl();
  return e.includes(t) || e.includes("localhost") || e.includes("../app/index.html");
}
function A(e, t) {
  return $(e.info.url) ? "新建标签页" : t;
}
function U(e, t, n) {
  const i = t.id;
  e.webContents.setWindowOpenHandler((o) => {
    console.log("[setWindowOpenHandler] 拦截到 window.open, url:", o.url);
    const s = p();
    s != null && s.view && n.contentView.removeChildView(s.view);
    const { view: a, tabInfo: l } = m({ url: o.url, title: "新窗口" });
    return D(o.url) ? a.webContents.loadURL(o.url) : a.webContents.loadFile(o.url), U(a, l, n), n.contentView.addChildView(a), f(r.get(l.id), n), n.webContents.send("tab:list-changed"), { action: "deny" };
  }), e.webContents.on("did-start-loading", () => {
    const o = r.get(i);
    o && (o.info.isLoading = !0, n.webContents.send("tab:loading", { id: i, isLoading: !0 }));
  }), e.webContents.on("did-stop-loading", () => {
    const o = r.get(i);
    o && (o.info.isLoading = !1, n.webContents.send("tab:loading", { id: i, isLoading: !1 }));
  }), e.webContents.on("did-finish-load", () => {
    const o = r.get(i);
    if (o) {
      const s = e.webContents.getURL();
      o.info.url.startsWith("lsqapp://") ? (o.info.actualUrl = s, P(o.info.title, s)) : $(o.info.url) || (o.info.url = s, o.info.title = A(o, e.webContents.getTitle() || o.info.title), P(o.info.title, s), n.webContents.send("tab:info-changed", o.info)), E(i, n);
    }
  }), e.webContents.on("did-navigate-in-page", (o, s, a) => {
    if (a) {
      const l = r.get(i);
      l && (l.info.url.startsWith("lsqapp://") ? l.info.actualUrl = s : l.info.url = s, E(i, n));
    }
  }), e.webContents.on("did-navigate", (o, s) => {
    const a = r.get(i);
    a && (a.info.url.startsWith("lsqapp://") ? a.info.actualUrl = s : (a.info.url = s, a.info.title = A(a, e.webContents.getTitle())), n.webContents.send("tab:info-changed", a.info), E(i, n));
  }), e.webContents.on("page-title-updated", (o, s) => {
    const a = r.get(i);
    if (a) {
      const l = A(a, s);
      l !== a.info.title && (a.info.title = l, n.webContents.send("tab:info-changed", a.info));
    }
  }), e.webContents.on("context-menu", (o, s) => {
    const a = [];
    s.isEditable && (a.push({ label: "剪切", role: "cut" }), a.push({ label: "复制", role: "copy" }), a.push({ label: "粘贴", role: "paste" }), a.push({ type: "separator" })), a.push(
      { label: "刷新", role: "reload" },
      { label: "开发者工具", click: () => e.webContents.openDevTools() }
    ), H.buildFromTemplate(a).popup();
  });
}
let v = null, V = 0;
function F(e, t = "index.html") {
  return `http://localhost:${V}/${e}/${t}`;
}
async function ye() {
  return new Promise((e, t) => {
    const n = b.isPackaged ? c.join(process.resourcesPath, "apps") : c.join(process.env.APP_ROOT, "..", "apps");
    v = N.createServer((i, o) => {
      const s = i.url || "/";
      if (s.startsWith("/proxy/")) {
        const l = s.replace("/proxy/", "");
        console.log(`[subappServer] 代理请求: ${s} -> ${l}`);
        const y = N.request(l, {
          method: i.method,
          headers: i.headers
        }, (h) => {
          o.writeHead(h.statusCode, h.headers), h.pipe(o);
        });
        y.on("error", (h) => {
          console.error("[subappServer] 代理错误:", h), o.writeHead(502, { "Content-Type": "text/plain" }), o.end("Proxy Error");
        }), i.pipe(y);
        return;
      }
      const a = c.join(n, s);
      if (console.log(`[subappServer] 请求: ${s} -> 实际路径: ${a}`), !a.startsWith(n)) {
        o.writeHead(403), o.end("Forbidden");
        return;
      }
      x.readFile(a, (l, y) => {
        if (l) {
          if (console.log(`[subappServer] 文件读取失败: ${l.code} - ${a}`), l.code === "ENOENT") {
            const Y = c.join(c.dirname(a), "index.html");
            x.readFile(Y, (z, K) => {
              z ? (o.writeHead(404), o.end("Not Found")) : (o.writeHead(200), o.end(K));
            });
          } else
            o.writeHead(500), o.end("Server Error");
          return;
        }
        const h = c.extname(a).toLowerCase(), X = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon"
        }[h] || "application/octet-stream";
        o.writeHead(200, { "Content-Type": X }), o.end(y);
      });
    }), v.listen(0, () => {
      const i = v.address();
      i && typeof i == "object" ? (V = i.port, console.log("[subappServer] 子应用服务器启动"), console.log(`[subappServer] appsDir: ${n}`), console.log(`[subappServer] 端口: ${V}`), e(V)) : t(new Error("Failed to get server port"));
    }), v.on("error", t);
  });
}
function Le() {
  v && (v.close(), v = null);
}
function B(e) {
  if (!e.startsWith("apps://")) return null;
  try {
    const t = new URL(e), n = t.hostname, i = t.pathname || "/";
    return F(n, `index.html#${i === "/" ? "" : i}`);
  } catch {
    return null;
  }
}
function Ve(e) {
  d.handle("tabs:list", async () => [...r.values()].map((t) => t.info)), d.handle("tabs:create", async (t, n) => {
    const i = p();
    i != null && i.view && e.contentView.removeChildView(i.view);
    const { view: o, tabInfo: s } = m(n);
    U(o, s, e);
    const a = B(n.url);
    return a ? o.webContents.loadURL(a) : n.url.startsWith("http") ? o.webContents.loadURL(n.url) : o.webContents.loadFile(n.url), e.contentView.addChildView(o), f(r.get(s.id), e), e.webContents.send("tab:list-changed"), s.id;
  }), d.handle("tabs:createDefault", async () => {
    const t = R.getAppUrl();
    console.log("[createDefault] 加载 URL:", t);
    const n = p();
    n != null && n.view && e.contentView.removeChildView(n.view);
    const i = {
      title: te.title,
      url: t
    }, { view: o, tabInfo: s } = m(i);
    return U(o, s, e), o.webContents.loadURL(t), e.contentView.addChildView(o), f(r.get(s.id), e), e.webContents.send("tab:list-changed"), s.id;
  }), d.handle("tabs:createHistory", async () => {
    const t = R.getHistoryUrl();
    console.log("[createHistory] 加载 URL:", t);
    const n = p();
    n != null && n.view && e.contentView.removeChildView(n.view);
    const i = {
      title: "历史记录",
      url: t
    }, { view: o, tabInfo: s } = m(i);
    return U(o, s, e), o.webContents.loadURL(t), e.contentView.addChildView(o), f(r.get(s.id), e), e.webContents.send("tab:list-changed"), s.id;
  }), d.on("tabs:refresh", () => {
    Ee(e);
  }), d.on("tabs:updateUrl", (t, n) => {
    var o;
    const i = B(n) || n;
    Ue(i, e), f(r.get((o = p()) == null ? void 0 : o.info.id), e);
  }), d.handle("tabs:switch", async (t, n) => {
    const i = p();
    i != null && i.view && e.contentView.removeChildView(i.view);
    const o = r.get(n);
    if (o) {
      e.contentView.addChildView(o.view), f(o, e), ne(n);
      const s = o.view.webContents.canGoBack(), a = o.view.webContents.canGoForward();
      o.info.canGoBack = s, o.info.canGoForward = a, console.log("[tabs:switch] tabId:", n, "canGoBack:", s, "canGoForward:", a), e.webContents.send("tab:can-navigate", { id: n, canGoBack: s, canGoForward: a });
    }
    return !0;
  }), d.handle("tabs:close", async (t, n) => {
    const i = ie(n, e);
    return e.webContents.send("tab:list-changed", i), i;
  }), d.on("tabs:goBack", () => {
    ve(e);
  }), d.on("tabs:goForward", () => {
    Ce(e);
  }), d.handle("history:get", async () => be()), d.handle("history:clear", async () => (he(), !0)), d.handle("history:delete", async (t, n) => (ge(n), !0)), d.on("tabs:openDevTools", () => {
    se();
  });
}
const W = c.dirname(j(import.meta.url));
process.env.APP_ROOT = c.join(W, "..");
const I = process.env.VITE_DEV_SERVER_URL, Se = c.join(process.env.APP_ROOT, "dist-electron"), M = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = I ? c.join(process.env.APP_ROOT, "public") : M;
let g;
function q() {
  H.setApplicationMenu(null), g = new G({
    icon: c.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: c.join(W, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webviewTag: !0
    }
  }), I ? g.loadURL(I) : g.loadFile(c.join(M, "index.html"));
  const e = R.getAppUrl();
  console.log("[createWindow] 加载 app URL:", e), Re({
    title: "新建标签页",
    url: e
  }, g), g.on("resize", () => {
    const t = p();
    t && f(t, g);
  }), Ve(g), I && g.webContents.openDevTools();
}
b.on("window-all-closed", () => {
  process.platform !== "darwin" && b.quit();
});
b.on("will-quit", () => {
  le(), Le();
});
b.on("activate", () => {
  G.getAllWindows().length === 0 && q();
});
b.whenReady().then(async () => {
  await ye(), _.handle("lsqapp", async (e) => {
    const t = e.url, n = new URL(t), i = n.hostname, o = n.pathname.slice(1) || "", s = F(i, `index.html#/${o}`);
    return Response.redirect(s, 302);
  }), _.handle("open-lsqapp", async (e) => {
    const t = e.url, i = new URL(t).pathname.slice(1), o = F("internal-app", `index.html#/${i}`);
    return Response.redirect(o, 302);
  }), k(), q();
});
export {
  Se as MAIN_DIST,
  M as RENDERER_DIST,
  I as VITE_DEV_SERVER_URL
};
