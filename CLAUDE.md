# electron-vite-project (容器项目)

## 角色
这是一个 **Electron 桌面容器应用**, 采用多标签页浏览器架构, 通过 `lsqapp://` 自定义协议加载一个或多个 Vue 子应用 (subapp) 作为内置页面.

容器本身负责: 窗口/标签管理、协议路由、本地 HTTP 服务器、子应用间通信桥.

## 子应用地图 (Cross-Project Map)

> 这是 AI 跨项目工作的核心信息. 修改任一项目前, 必须先在两边都读相关代码.

| 子应用 | 源码位置 | dev URL | 协议名 | 容器内构建产物 |
|---|---|---|---|---|
| internal-app | `C:\Users\lsq\my-projects\app` | http://localhost:5273 | `lsqapp://internal-app` | `apps/internal-app/dist/` |

未来若有更多子应用, 按此表扩展.

## 架构核心

```
┌─────────────────────────────────────────────────────────┐
│ Electron 主进程 (electron/main.ts)                       │
│   ├─ protocol 'lsqapp://'   → 302 到子应用 dev URL        │
│   ├─ protocol 'open-lsqapp://' → 外部唤醒入口             │
│   └─ startSubappServer() (electron/subapp/)              │
│        └─ 本地 HTTP 服务器, 监听随机端口                  │
│             ├─ /proxy/* → 通用 HTTP 代理                  │
│             └─ /*       → 读 apps/<name>/dist/ 静态文件   │
└─────────────────────────────────────────────────────────┘
            │
            │ window.bridge (contextBridge)
            ▼
┌─────────────────────────────────────────────────────────┐
│ 子应用渲染进程 (如 internal-app)                          │
│   ├─ 子应用自己的 vue-router                              │
│   └─ 通过 window.bridge.getModules([...]) 拿 IPC 桥       │
└─────────────────────────────────────────────────────────┘
```

## 关键目录

- [electron/main.ts](electron/main.ts) — 主进程入口, 注册协议
- [electron/subapp/](electron/subapp/) — 本地 HTTP 服务器 (fileHandler / proxy / router / index)
- [electron/tab/tabHandlers.ts](electron/tab/tabHandlers.ts) — 标签页 IPC handlers (tabs:*)
- [electron/preload.ts](electron/preload.ts) — 基础 ipcRenderer 桥 (`window.ipcRenderer`)
- [electron/preload-app.ts](electron/preload-app.ts) — 子应用专用桥 (`window.bridge.getModules`)
- [electron/modules/](electron/modules/) — 各 IPC 模块实现 (tabs / history / aiConversation)
- [electron/env.ts](electron/env.ts) — dev/packaged 模式下 app URL 解析
- [src/App.vue](src/App.vue) — 容器 UI (标签栏 + URL 栏 + 书签栏)

## 跨项目契约 (CRITICAL — 改任何一边必须同步另一边)

### 1. `lsqapp://` 协议解析规则
定义在 [electron/main.ts](electron/main.ts#L82-L91):
```
lsqapp://<appName>/<route>
  ↓ 302 Redirect
http://localhost:<subappPort>/<appName>/index.html#/<route>
```

**dev 模式**: 当前是写死的子应用 dev URL (env.ts#L6-L11), 没经过 subapp server. 修改 `getAppUrl`/`getHistoryUrl` 时同时检查 [electron/main.ts](electron/main.ts) 中的 302 路径, 两边要保持一致.

### 2. 子应用通过 `window.bridge` 调用容器能力
子应用代码 (如 [internal-app App.vue](C:\Users\lsq\my-projects\app\src\App.vue)) 调用:
```js
window.bridge.getModules(['history', 'ai'])  // 按需拿模块
```
当前已注册的模块 (在 [electron/preload-app.ts](electron/preload-app.ts#L7-L11) 和 [electron/modules/](electron/modules/)):
- `tabs` — 标签页操作
- `history` — 历史记录 CRUD
- `ai` — AI 会话 CRUD

**新增模块时** 三处必须同步:
1. 新建 `electron/modules/<name>.ts`, 实现 proxy
2. 在 [electron/preload-app.ts](electron/preload-app.ts) `moduleRegistry` 注册
3. 在 [electron/main.ts](electron/main.ts) 或 [tabHandlers.ts](electron/tab/tabHandlers.ts) 添加对应的 `ipcMain.handle`/`on`

### 3. 构建产物路径
子应用 `pnpm build` → 子项目 `dist/` → 手动/脚本拷贝到容器 `apps/<name>/dist/`.
生产模式下 [electron/subapp/index.ts](electron/subapp/index.ts#L21-L23) 读取 `apps/<name>/dist/`.

## 标签系统要点

- 容器 UI 用 webviewTag + contentView, 每个标签是独立的 BrowserView
- 标签列表通过 `tabs:list` / `tabs:create` / `tabs:close` / `tabs:switch` IPC 管理
- 导航状态 (`canGoBack` / `canGoForward`) 通过 `tab:can-navigate` 事件回流到 UI
- 容器认 `lsqapp://internal-app` 为"内置默认页", URL 栏隐藏 (见 [src/App.vue](src/App.vue#L33-L37))

## 常用开发命令

```bash
# 容器单独启动 (使用子应用的 dev URL, 不依赖子应用 dist)
pnpm dev

# 单独 build 容器主进程 + preload
pnpm build

# 打包桌面应用
pnpm build && electron-builder
```

**子应用必须先单独启动** (见子项目的 CLAUDE.md), 否则 dev 模式下 `getAppUrl()` 返回的端口连不上.

## 改代码前自查清单

- [ ] 修改了协议? 检查 [electron/main.ts](electron/main.ts) + [electron/env.ts](electron/env.ts) + 子项目路由.
- [ ] 新增了 IPC 模块? 三处同步: 模块实现 / preload 注册 / main 注册.
- [ ] 新增了子应用? 扩展顶部"子应用地图" + 在 [electron/subapp/](electron/subapp/) 配置 dev 端口转发.
- [ ] 不要直接编辑 `apps/<name>/dist/` 下的产物, 那是从子项目 `dist/` 拷贝过来的构建结果.