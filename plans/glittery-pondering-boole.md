# Plan: 优化 `tabs:restore` 中的调试日志

## Context

代码审查第 6 点指出 [tabHandlers.ts:248-275](electron/tabs/tabHandlers.ts#L248-L275) 中 `tabs:restore` handler 包含大量 `console.log` 诊断语句，需要清理或改用正式日志。

## 变更内容

文件: `electron/tabs/tabHandlers.ts`

**删除以下 console.log 语句**（共约 8 处）：

```ts
// 删除这些
console.log('[tabs:restore] windowId param:', windowId)
console.log('[tabs:restore] event.sender.id:', event.sender.id)
console.log('[tabs:restore] win from windowId:', win?.id, 'isDestroyed:', win?.isDestroyed())
console.log('[tabs:restore] BrowserWindow.fromWebContents(event.sender):', senderWin?.id)
console.log('[tabs:restore] popupSourceMap entries:', [...popupSourceMap.entries()])
console.log('[tabs:restore] sourceWindowId from popupSourceMap:', sourceWindowId)
console.log('[tabs:restore] fallback win.id:', win?.id)
console.log('[tabs:restore] 最终使用 win.id:', win.id)
console.log('[tabs:restore] savedTabs:', savedTabs.length)
console.log('[tabs:restore] creating tab:', savedTab.title, savedTab.url)
console.log('[tabs:restore] tabs:', ctx.tabs.length, 'sending tab:list-changed')
```

**保留以下有实际业务价值的日志**：
- `console.log('[tabs:restore] restoring', savedTabs.length, 'tabs')` — 改为单行摘要
- 其他诊断性日志全部删除

## 验证

- [ ] 编译通过 `pnpm build`
- [ ] dev 模式启动，正常显示标签页恢复弹窗
