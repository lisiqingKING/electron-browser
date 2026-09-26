# IPC 模块重构方案

## 背景

重构目标：简化 IPC 注册流程，主进程模块自动注册 handler，preload 自动生成 proxy。

## 架构原则

### 事件订阅 vs 方法调用

| 类型 | 主进程 | 渲染进程 |
|------|--------|----------|
| **RPC 调用** | `ipcMain.handle(channel, fn)` | `ipcRenderer.invoke(channel, ...args)` |
| **事件订阅** | `webContents.send(channel, data)` | `window.bridge.on(channel, handler)` |

### 事件 channel 命名规范

- 格式：`{module}:{event}`，如 `downloads:added`、`ai:start`
- 主进程推送事件使用独立 channel，不使用 type-dispatched 单 channel

## 模块分类

### 1. 简单模块（已实现自动注册）

**clipboard**、**history**：只涉及 RPC 调用，无事件订阅。

```
主进程: registerModuleHandlers('clipboard', clipboardModule)
preload: createProxy('clipboard', clipboardProxyDef, ipcRenderer)
```

### 2. 特殊模块（保留原有 create*Proxy 模式）

| 模块 | 原因 |
|------|------|
| **AI** | 有 `onStart/onChunk/onComplete/onHalted/onError` 流式事件 |
| **downloads** | 子项目 `useDownloads.ts` 依赖 `onAdded/onProgress/onRemoved` |
| **settings** | 有 `onThemeChanged` 事件订阅 |
| **wallpaper** | 有事件订阅需求 |
| **tabs** | invoke/send 混用，复杂 |
| **window** | createSubscription 封装 |
| **logs** | 有 `send` 方法 |
| **favorites** | 有事件订阅 |
| **popup** | 有 send + 事件订阅 |

### 3. 子项目调用规范

**正确做法：事件订阅统一使用 `window.bridge.on()`**

```typescript
// ✅ 正确
window.bridge.on('downloads:added', (task) => { ... })
window.bridge.on('downloads:progress', (progress) => { ... })
window.bridge.on('ai:start', (messageId) => { ... })

// ❌ 错误 - 不应该通过模块的封装方法
downloads.onAdded(handler)  // 已被移除
```

**原因**：模块 proxy 只封装 RPC 调用，事件订阅统一走 `bridge.on()` 可以：
1. 减少 preload 代码复杂度
2. 统一事件订阅方式
3. 子项目无需关心具体模块的事件封装

## 当前状态

### 已完成
- [x] `electron/shared/autoIpc.ts` - 自动注册工具
- [x] `electron/modules/clipboard/index.ts` - clipboard 模块
- [x] `electron/modules/history/index.ts` - history 模块
- [x] `electron/bootstrap.ts` - 调用 registerModuleHandlers
- [x] `preload/preload.ts` - 使用 createProxy 简化
- [x] AI 模块改用独立 channel (`ai:start`, `ai:chunk`, `ai:complete`)
- [x] Downloads 模块 notifier 改用独立 channel (`downloads:added`, `downloads:progress`, `downloads:removed`)

### 待完成
- [ ] downloads ipcClient.ts 清理（移除旧的 type-dispatched event）
- [ ] 子项目 `useDownloads.ts` 改用 `window.bridge.on()` 替代 `downloads.onAdded()`
- [ ] 其他模块事件 channel 统一梳理

## Downloads 模块修复方案

### 问题
- `notifier.ts` 已改用独立 channel：`downloads:added`、`downloads:progress`、`downloads:removed`
- `channels.ts` 已添加对应常量
- `ipcClient.ts` 还在用旧的 `downloadsChannels.event`（不存在）

### 方案
**方案 A（推荐）**：简化 downloads proxy，移除 `onAdded/onProgress/onRemoved`，子项目改用 `bridge.on()`

```typescript
// downloads proxy 简化为只剩 RPC 方法
export function createDownloadsProxy() {
  return {
    list: (...args) => ipcRenderer.invoke(downloadsChannels.list, ...args),
    add: (...args) => ipcRenderer.invoke(downloadsChannels.add, ...args),
    // ...
  }
}
```

子项目修改：
```typescript
// useDownloads.ts
const downloads = window.bridge.getModules(['downloads']).downloads
window.bridge.on('downloads:added', onAdded)
window.bridge.on('downloads:progress', onProgress)
window.bridge.on('downloads:removed', onRemoved)
```

**方案 B（兼容）**：保留 `onAdded` 等方法，但改用独立 channel 订阅

```typescript
// downloads proxy
onAdded(fn) {
  ensureListener(downloadsChannels.added, fn)
  // ...
}
```

## 验证清单

- [ ] `pnpm build` 编译通过
- [ ] `pnpm dev` 启动正常
- [ ] 复制粘贴功能正常（clipboard）
- [ ] 历史记录正常（history）
- [ ] AI 对话正常（ai）
- [ ] 下载功能正常（downloads）- 需要子项目配合
- [ ] 主题切换正常（settings）
- [ ] 标签页操作正常（tabs）
