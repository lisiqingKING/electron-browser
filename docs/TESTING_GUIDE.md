# 测试指南

## 三层测试策略

| 层次 | 目标 | 覆盖率目标 |
|---|---|---|
| 单元测试 | 纯函数、安全逻辑、工具函数 | 80%+ |
| 集成测试 | IPC 路由、模块间协作、数据库 | 核心路径覆盖 |
| E2E 测试 | 关键用户流程（tab 生命周期、下载、安全拦截） | 5-10 个关键路径 |

---

## 单元测试

### 测什么

纯函数，输入输出可预测，不需要 mock Electron API：

| 模块 | 测试场景 |
|---|---|
| `coreUtils` | `getTitleForUrl` / `clearCrashTitle` / `appendCrashTitle` |
| `coreUtils` | `escapeForJsString` 注入字符转义 |
| `coreUtils` | URL 合法性判断（`isInternalUrl` / `isAppUrl` / `isUrl`） |
| `securityHandlers` | 危险 URL 正则 `javascript:` / `data:` 拦截 |
| `stabilityHandlers` | `clean-exit` / `killed` 不触发崩溃恢复 |

### 不测什么

依赖 Electron API 的函数（如 `ipcRenderer.on`、`view.webContents.loadURL`），因为 mock 成本高，测试本身比代码还脆弱。

### 框架

**Vitest** — 轻量、快速、TypeScript 原生。

```bash
pnpm add -D vitest
```

测试文件放在 `electron/` 同级目录：

```
electron/
  tabs/
    handlers/
tests/
  unit/
    coreUtils.test.ts
    securityHandlers.test.ts
    stabilityHandlers.test.ts
```

### mock 策略

`electron` 模块在测试中 mock：

```ts
// vitest.setup.ts
import { vi } from 'vitest'
vi.mock('electron', () => ({
  ipcRenderer: {
    on: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn(),
  },
}))
```

---

## 集成测试

### 测什么

模块之间的配合、IPC handler 响应、数据库操作，用真实依赖而非 mock：

| 模块 | 测试场景 |
|---|---|
| `ipcClient` 订阅分发 | `downloadsChannels.event` push → 正确路由到 `onAdded` / `onProgress` / `onRemoved` |
| `ipcClient` 订阅分发 | `settings:theme-changed` → 触发 `onThemeChanged` |
| IPC handler | `tabs:create` 调用后 DB 中有记录 |
| IPC handler | `downloads:add` → manager 队列增加 |
| 数据库 | `tabsDb` 增删改查 |

### 数据库：in-memory SQLite

用 `better-sqlite3` 的 `:memory:` 模式，不碰生产数据：

```ts
// 每个测试用独立的内存 DB
const testDb = new Database(':memory:')

// 多连接需要共享时用 shared cache
const db = new Database('file::memory:?cache=shared&mode=memory')
```

测试时通过依赖注入替换 DB 连接：

```ts
// 测试入口
registerTabHandlers({ db: testDb })
registerDownloadHandlers({ db: testDb })
```

### 不测什么

需要 mock `BrowserWindow` / `WebContents` 的场景（如 tab 创建流程），因为 mock 层太厚，测不出真实问题。

---

## E2E 测试

### 测什么

跨进程的真实用户流程，模拟真实交互：

| 场景 | 说明 |
|---|---|
| 标签页创建 → 切换 → 关闭 | 全流程验证 webContents 状态、UI 更新 |
| 崩溃恢复 | 模拟 `render-process-gone`，验证标题变化 + 自动 reload |
| 下载流程 | 从点击链接到文件落盘，全链路 |
| 主题切换 | 设置 → 主进程 push → 所有 window 生效 |
| 危险 URL 拦截 | `javascript:` 输入 → 验证未创建 tab |

### 框架

**Playwright** + `@playwright/test` 配 Electron：

```bash
pnpm add -D @playwright/test
npx playwright install --with-electron chromium
```

### 配置

`playwright.config.ts`：

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'electron',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

E2E 测试需要打包后的 app binary，不能在 dev 模式跑。生产流程用 `electron-builder` 打包后执行。

---

## 安全测试

### 测什么

核心安全防线，需要覆盖：

| 场景 | 验证 |
|---|---|
| `will-navigate` 拦截 `javascript:` | 正则 `^javascript\s*:` 匹配 |
| `will-navigate` 拦截 `data:` | 正则 `^data\s*:` 匹配 |
| `will-navigate` 放行正常 URL | `https://example.com` 不被拦截 |
| `setWindowOpenHandler` 拦截 | `javascript:` / `data:` 返回 `{ action: 'deny' }` |
| CSP 响应头存在 | HTML 响应有 `Content-Security-Policy` 头 |
| CSP `script-src 'self'` | 内联脚本被浏览器 block |

---

## 运行测试

```bash
# 单元测试
pnpm test:unit

# 集成测试
pnpm test:integration

# E2E（需要打包）
pnpm build && pnpm test:e2e

# 全部测试
pnpm test
```

---

## 测试驱动开发（TDD）建议

新功能开发流程：

1. **红** — 写一个不通过的测试，明确预期行为
2. **绿** — 写最少的代码让测试通过
3. **重构** — 清理代码，保持测试通过

针对本次新增的安全/稳定性功能，推荐优先写：

```bash
# 先跑通现有单元测试
pnpm test:unit

# 覆盖危险 URL 拦截逻辑
tests/unit/securityHandlers.test.ts
```

回归测试在每次 `git commit` 前运行，CI 在 pre-push 阶段执行。
