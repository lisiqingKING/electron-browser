# AI 协作文档

> 本文档指导 AI 辅助开发，确保协作质量和架构一致性。

---

## 一、协作规则

### 1. 数据单向流动 (Single Source of Truth)

> **数据有一个来源，单向流动。多份副本 = 漂移 = bug。**

- 主进程是唯一数据源（拥有 webContents、SQLite 等）
- 渲染进程是纯展示层，被动接收主进程推送
- **三条具体规则：**
  1. 主进程推送事件前要预过滤，不要让渲染进程过滤
  2. 不要在数据结构中缓存派生状态（如 `canGoBack`），按需查询
  3. 渲染进程 invoke 后等待主进程 push，不要自行修改状态

### 2. 不懂就问

- 对需求有疑问，先问清楚再动手
- 对实现不确定，先问用户确认
- **不要假设，要验证**

### 3. 方案对比

- 实现功能时提供 **2-3 个主流方案**
- 每个方案说明：
  - 优点
  - 缺点
  - 适用场景
- 用户决策后记录理由

### 4. 修改前三件事（跨项目同步）

| 修改类型 | 检查项 |
|---------|--------|
| 修改协议 | `electron/main.ts` + `electron/env.ts` + 子应用路由 |
| 新增 IPC 模块 | 模块实现 / preload 注册 / main 注册 |
| 新增子应用 | 扩展子应用地图 + subapp 配置 |

### 5. Review 要对照流程图

- 不能只"扫一眼"，要对照 Stage 1 流程图验证分支覆盖
- 重点检查：异常路径、边界条件、与原意偏离
- 反问验证：
  - "删掉这段会怎样？" — 验证必要性
  - "X 场景下走哪个分支？" — 验证覆盖度

### 6. YAGNI 原则

- **主动建议删除**过度抽象，不是添加
- 问自己："这个间接层真的在解决当前问题吗？"
- 命名用直接动词，不用前缀模式（如 `markX`）
- 三步协议是坏味道，主动提议压缩到两步

### 7. 决策理由要记录

- Stage 2 产出不只是"选了 A"
- 要写 **"为什么不选 B/C"**
- 写入任务说明，后续回看有据

### 8. 功能完成要产出模块文档

模块 md 模板：
```
## 目的
## 接口
## 关键流程（附流程图链接）
## 假设
## 依赖
## 已知限制
```

---

## 二、项目架构总览

```
┌─────────────────────────────────────────────────────────┐
│ Electron 主进程 (electron/main.ts)                       │
│   ├─ protocol 'lsqapp://'   → 302 到子应用 dev URL        │
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

---

## 三、容器目录结构详解

### electron/ — 主进程

| 目录/文件 | 职责 |
|-----------|------|
| `main.ts` | 主进程入口，注册协议，创建窗口 |
| `preload.ts` | 基础 ipcRenderer 桥 (`window.ipcRenderer`) |
| `preload-app.ts` | 子应用专用桥 (`window.bridge.getModules`) |
| `env.ts` | dev/packaged 模式下 app URL 解析 |
| `broadcast.ts` | 主→渲染事件广播 |
| **tab/** | 标签系统 |
| `tab/tabCore.ts` | 核心数据结构定义 |
| `tab/tabHandlers.ts` | `tabs:*` IPC handlers |
| `tab/tabNavigation.ts` | 导航逻辑（前进/后退） |
| `tab/tabEvents.ts` | 标签状态事件推送 |
| **modules/** | IPC 模块代理（子应用调用） |
| `modules/tabs.ts` | 标签页操作代理 |
| `modules/history.ts` | 历史记录代理 |
| `modules/aiConversation.ts` | AI 会话代理 |
| `modules/logs.ts` | 日志读取代理 |
| **history/** | 历史记录业务 |
| `history/historyManager.ts` | 业务逻辑 |
| `history/historyDb.ts` | SQLite 操作 |
| **ai/** | AI 会话业务 |
| `ai/aiConversationManager.ts` | 业务逻辑 |
| `ai/aiConversationDb.ts` | SQLite 操作 |
| **downloads/** | 下载管理（独立模块） |
| `downloads/downloadManager.ts` | 下载管理器 |
| `downloads/downloadHandlers.ts` | IPC handlers |
| `downloads/internal/` | 内部实现（任务、调度、通知） |
| `downloads/sources/` | 下载源（http、webview） |
| **memory/** | 内存监控 |
| `memory/memoryMonitor.ts` | 内存采集 |
| `memory/memoryConfig.ts` | 配置 |
| **database/** | SQLite 封装 |
| `database/index.ts` | 数据库初始化 |
| **subapp/** | 子应用服务器 |
| `subapp/index.ts` | 服务器入口 |
| `subapp/fileHandler.ts` | 静态文件服务 |
| `subapp/proxy.ts` | 代理转发 |
| `subapp/router.ts` | 路由 |

### src/ — 容器 UI (Vue)

| 文件 | 职责 |
|------|------|
| `App.vue` | 主布局（标签栏 + URL栏 + 书签栏） |
| `components/TabBar.vue` | 标签栏组件 |
| `components/UrlBar.vue` | URL栏组件 |
| `main.ts` | Vue 入口 |

### apps/ — 子应用构建产物

```
apps/
└── internal-app/
    └── dist/    ← 从子项目 dist/ 拷贝
```

---

## 四、子项目结构

### internal-app

| 属性 | 值 |
|------|-----|
| 源码位置 | `C:\Users\lsq\my-projects\app` |
| dev URL | `http://localhost:5273` |
| 协议名 | `lsqapp://internal-app` |
| 构建产物 | `apps/internal-app/dist/` |

子项目目录结构：
```
C:\Users\lsq\my-projects\app\
├── src/
│   ├── App.vue          # 子应用入口
│   ├── views/           # 页面组件
│   ├── router/          # vue-router
│   └── ...
└── dist/                # 构建产物（需拷贝到容器 apps/）
```

### 未来子扩展

新增子应用时：
1. 在子项目 CLAUDE.md 中添加协议信息
2. 在容器 CLAUDE.md 的"子应用地图"中添加一行
3. 配置 subapp/ 的 dev 端口转发

---

## 五、关键文件职责表

| 文件 | 职责 | 关联文件 |
|------|------|---------|
| `main.ts` | 注册协议、创建窗口 | `env.ts`, `tab/` |
| `preload-app.ts` | window.bridge 模块注册 | `modules/*` |
| `tabHandlers.ts` | `tabs:*` IPC 处理 | `tabCore.ts`, `broadcast.ts` |
| `broadcast.ts` | 主→渲染事件推送 | `tabEvents.ts`, `modules/` |
| `env.ts` | URL 解析 | `main.ts` |

---

## 六、跨项目契约三件事

### 1. lsqapp 协议变更

```
lsqapp://<appName>/<route>
  ↓ 302 Redirect
http://localhost:<subappPort>/<appName>/index.html#/<route>
```

**修改时检查：**
- [ ] `electron/main.ts` — 302 路径
- [ ] `electron/env.ts` — `getAppUrl`/`getHistoryUrl`
- [ ] 子应用路由配置

### 2. 新增 IPC 模块

**三处同步：**
1. 新建 `electron/modules/<name>.ts` — 实现 proxy
2. 在 `electron/preload-app.ts` `moduleRegistry` 注册
3. 在 `electron/main.ts` 或 `tabHandlers.ts` 添加 `ipcMain.handle`/`on`

### 3. 新增子应用

**扩展：**
- [ ] 子应用地图（CLAUDE.md）
- [ ] `electron/subapp/` 配置 dev 端口转发

---

## 七、常用开发命令

```bash
# 容器单独启动（使用子应用的 dev URL）
pnpm dev

# 单独 build 容器主进程 + preload
pnpm build

# 打包桌面应用
pnpm build && electron-builder
```

**注意：** 子应用必须先单独启动，否则 dev 模式下连不上。

---

*文档版本：2026-07-24*
