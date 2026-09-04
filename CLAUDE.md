# electron-vite-project (容器项目)

> AI 辅助开发的主要参考文档。详细内容见下方链接。

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构、IPC 通信、启动时序、标签页生命周期、URL 解析、下载管理 |
| [docs/COLLABORATION.md](docs/COLLABORATION.md) | 协作规范（TDD、YAGNI、数据流、方案对比等） |
| [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | 测试策略、数据库 mock、TDD 流程 |

## 开发命令

```bash
pnpm dev        # 启动容器（需先启动子应用）
pnpm build      # build 主进程 + preload
pnpm build && electron-builder  # 打包
```

## 改代码前自查清单

- [ ] 修改了协议? 检查 `electron/mainEntry/protocol.ts` + `electron/shared/env.ts` + 子项目路由
- [ ] 新增了 IPC 模块? 三处同步: 模块实现 / preload 注册 / bootstrap 注册
- [ ] 新增了子应用? 扩展 docs/ARCHITECTURE.md 的子应用地图 + subapp 配置
- [ ] 不要直接编辑 `apps/<name>/dist/`，那是子项目构建产物
- [ ] 修改渲染进程的模块调用? 先看既有组件是如何获取模块的，遵循相同模式（`window.bridge.getModules(['xxx']).xxx`），**不要**自己发明新的调用方式

## Vue 组件规范

### 事件监听: 用 `useEventListener` 替代裸 `addEventListener`

**必须用 `@vueuse/core` 的 `useEventListener`**（自动配对 `removeEventListener`，组件卸载时自动清理）:

```vue
<script setup>
import { useEventListener } from '@vueuse/core'

// ✅ 正确：自动配对
useEventListener(messagesRef.value, 'scroll', handleScroll)
useEventListener(window, 'resize', handleResize)

// ❌ 禁止裸写，容易遗漏清理
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))
</script>
```

### 组件拆分时机

- 单文件超过 300 行时，考虑拆分
- 模板里存在独立功能区块（菜单、弹窗、空状态、错误提示）时，拆成独立组件
- 拆分后的组件 Props/Emit 应自描述，不依赖父组件内部状态

### 流式输出 auto-scroll 行为

流式输出时不要每次数据变化都强制滚动到底部 — 判断用户是否在看底部（距底部 < 100px），只有在看底部时才 auto-scroll，用户往上翻看历史时不打断：

```ts
function isNearBottom(): boolean {
  const el = messagesRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value && isNearBottom()) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}
```
