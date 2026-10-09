# AI 辅助聊天浮动窗口实现计划

## Context

在 AI 主会话中遇到不懂的内容时，询问会干扰 AI 和个人对主会话的理解。需要一个独立的浮动聊天窗口作为辅助入口，随时可调起，不打断主会话流。

**需求**：
- 入口：AI 聊天气泡右键菜单 → "辅助会话"
- 窗口：浮动气泡，无边框、小标题栏（可拖动）、圆角透明
- 会话：独立新会话
- 数量：支持多个同时存在

## 实现方案

### 容器侧（`electron-vite-project`）

新增 `electron/modules/assistant/` 模块：

| 文件 | 作用 |
|------|------|
| `ipcClient.ts` | `assistantChannels` + `createAssistantProxy()` |
| `handlers.ts` | `assistant:create` / `assistant:close` handlers |
| `manager/index.ts` | Manager 导出 |
| `manager/WindowManager.ts` | 窗口创建/销毁（多窗口 Map 管理） |
| `manager/PositionCalculator.ts` | 位置计算（基于触发坐标 + 屏幕边界裁剪） |

**IPC Channels**：
```typescript
assistantChannels = {
  create: 'assistant:create',  // {x, y} → {windowId}
  close:  'assistant:close',   // {windowId}
}
```

**窗口配置**：
```typescript
{
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  width: 420,
  height: 520,
  resizable: true,
  movable: true,
  skipTaskbar: true,
  alwaysOnTop: true,
}
```

**多窗口管理**：维护 `Map<windowId, BrowserWindow>`，每个窗口独立生命周期。

**preload 注册**：
```typescript
// preload/preload.ts
assistant: () => createAssistantProxy(),
// bridge.channels.assistant = assistantChannels
```

### 子项目侧（`C:\Users\lsq\my-projects\app`）

| 文件 | 作用 |
|------|------|
| `src/views/ai/views/AssistantView.vue` | 辅助会话独立页面（路由 `#/assistant`） |
| `src/views/ai/components/messages/MessageBubble.vue` | 添加"辅助会话"菜单项 |
| `src/router/index.ts` | 添加 `/assistant` 路由 |

**右键菜单项**：
```typescript
// MessageBubble.vue
{ label: '辅助会话', action: () => {
  window.bridge.assistant.create({ x: event.screenX, y: event.screenY })
}}
```

## 关键设计

### 窗口创建流程
```
渲染进程                          主进程                          操作系统
   │                                │                               │
   │  assistant:create {x,y} ──────►│                               │
   │                                │  new BrowserWindow(...)       │
   │                                │  ────────────────────────────►│
   │                                │  win.loadURL(dev/prod URL)    │
   │                                │  ────────────────────────────►│
   │  ◄─────── assistant:ready      │                               │
   │        {windowId}              │  win.show()                   │
   │                                │  ────────────────────────────►│
```

### 辅助窗口内部结构
```
┌────────────────────────────────────────┐  ← 圆角透明气泡
│  title-bar（可拖动）          [−] [×]  │
├────────────────────────────────────────┤
│                                        │
│  AssistantView.vue                     │
│  #/assistant 路由                      │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 消息列表                          │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 输入框 + 发送                     │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### 可拖动标题栏实现
```typescript
// 标题栏 mousedown → 记录偏移 → mousemove → setPosition → mouseup 停止
titleBar.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || e.detail !== 1) return
  const startX = e.screenX, startY = e.screenY
  const winPos = win.getPosition()
  const offsetX = startX - winPos[0], offsetY = startY - winPos[1]

  const onMove = (e: MouseEvent) => {
    win.setPosition(e.screenX - offsetX, e.screenY - offsetY)
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
})
```

## 修改文件清单

### 容器侧
- `preload/preload.ts` — 注册 `assistant` 模块
- `electron/mainEntry/appReady.ts` — 调用 `registerAssistantHandlers()`
- `electron/modules/assistant/index.ts` — 新增
- `electron/modules/assistant/ipcClient.ts` — 新增
- `electron/modules/assistant/handlers.ts` — 新增
- `electron/modules/assistant/manager/index.ts` — 新增
- `electron/modules/assistant/manager/WindowManager.ts` — 新增
- `electron/modules/assistant/manager/PositionCalculator.ts` — 新增

### 子项目侧（`C:\Users\lsq\my-projects\app`）
- `src/router/index.ts` — 添加 `/assistant` 路由
- `src/views/ai/views/AssistantView.vue` — 新增
- `src/views/ai/components/messages/MessageBubble.vue` — 添加菜单项

## 复用现有模块

- AI 聊天：`window.bridge.ai.chat()` / `onChunk` / `onComplete`
- 会话 CRUD：`ai:list` / `ai:create` / `ai:delete`
- preload 模块注册模式：`createAssistantProxy()` 遵循 `createPopupProxy()` 模式
- 窗口创建参考：`electron/modules/popup/manager/WindowManager.ts`

## 验证方式

1. 在 AI 聊天气泡上右键 → 看到"辅助会话"菜单项
2. 点击后浮动窗口在鼠标位置附近弹出
3. 标题栏可拖动
4. 可输入并发起新会话（流式响应正常）
5. 可同时打开多个辅助窗口
6. 关闭按钮有效
