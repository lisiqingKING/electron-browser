# AI 辅助面板 测试用例文档

> 需求文档：[ASSISTANT_PANEL.md](ASSISTANT_PANEL.md) ｜ 版本：v1.0 ｜ 状态：与代码同步于 2026-10-23
>
> 本文回答的唯一问题：**每一条需求，凭什么说它实现了、且没坏。**
> 需求本身不在这里复述（那是需求文档的职责），这里只登记「期望 → 验证方式 → 验证位置 → 覆盖状态」。

---

## 1. 三方对照

```
需求文档 (ASSISTANT_PANEL.md)  ──需求 ID──▶  用例文档 (本文)  ──验证位置──▶  测试代码
       ▲                                    │
       └──────────  校验脚本反向核对  ◀───────┘
```

需求 ID 在两处各存一份必然漂移，所以本文的可信度不靠人工维护，靠 [scripts/check-req-coverage.mjs](../scripts/check-req-coverage.mjs) 做双向核对：

| 核对方向 | 拦截的问题 |
|---------|-----------|
| 需求 → 用例 | 需求文档里新增了 FR，但用例文档没登记 = 漏覆盖 |
| 用例 → 需求 | 用例文档写了需求文档里不存在的 ID = 幻觉 |
| 用例 → 代码 | 引用的测试文件被删了 / 用例被改名了 = 引用失效 |
| 状态 → 代码 | 标了 ✅ 却没有登记任何验证位置 = 自欺欺人 |

```bash
node scripts/check-req-coverage.mjs          # 容器仓库根目录
npm run check:req-coverage                   # 同上
```

---

## 2. 状态定义

| 标记 | 含义 | 判据 |
|-----|------|------|
| ✅ | 有自动化验证 | 至少一条测试用例的断言能直接判定这条需求的成败 |
| 🔸 | 部分覆盖 | 主干行为有断言，但边界/异常分支或某个实现约束没有断言 |
| ⚠️ | 仅人工验收 | 自动化测不到（依赖真实交互、真实窗口、代码实现约束），靠人工或代码审查 |
| ❌ | 未实现 | 需求写在文档里，代码里没有对应实现 |

**分组标题**（`FR-1` ~ `FR-7`）只是章节号，不单独登记用例；它们的覆盖状态由下辖子条目汇总。

---

## 3. 覆盖总览

### 3.1 FR-1 面板形态与尺寸

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| FR-1.1 | 顶部工具栏有「辅助面板」按钮，点击派发 `toggle-assistant` | 自动化 | `app:test/ChatTopToolbar.test.ts ›「点击辅助面板按钮，触发 toggle-assistant 事件」` | ✅ |
| FR-1.2 | 面板渲染在主窗口 DOM 内，容器不创建第二个 BrowserWindow | 人工 | `容器:electron/bootstrap.ts` | ⚠️ |
| FR-1.3 | 面板默认挤压主聊天区（主区收缩），不是覆盖式浮层 | 人工 | `app:src/views/ai/components/AiChat.vue` | ⚠️ |
| FR-1.4 | 全屏时面板占满主聊天区宽度，主区隐藏；非全屏时不渲染宽度拖拽条 | 自动化 | `app:test/AssistantPanel.test.ts ›「非全屏时按持久化宽度显示，全屏时占满」`；`app:test/AssistantPanel.test.ts ›「全屏时不渲染宽度拖拽条」` | ✅ |
| FR-1.5 | 左边缘分隔条可拖拽调宽，宽度钳制在 [400px, 视口 70%]；视口过窄时取两者较大值 | 自动化 | `app:test/AssistantPanel.test.ts ›「拖拽左边缘调整宽度，松开后持久化」`；`app:test/AssistantPanel.test.ts ›「宽度钳制在 [400px, 视口 70%]」`；`app:test/AssistantPanel.test.ts ›「视口过窄导致 70% < 400px 时取两者较大值」` | ✅ |
| FR-1.6 | 宽度写入 settings 的 `assistant.panelWidth`，重启后恢复且仍受钳制约束 | 自动化 | `app:test/AssistantPanel.test.ts ›「从 settings 恢复已保存的宽度、布局与全屏状态」`；`app:test/AssistantPanel.test.ts ›「恢复的宽度同样受钳制约束」` | ✅ |
| FR-1.7 | 关闭面板只隐藏，不触发任何数据写入 | 自动化 | `app:test/AssistantPanel.test.ts ›「关闭面板只隐藏，不触发任何数据写入」`；`app:test/AssistantFlow.test.ts ›「关闭面板后工作区的笔记仍在内存中」` | ✅ |
| FR-1.8 | 辅助面板与灵感大全互斥：打开辅助面板时灵感大全收起，打开灵感大全时辅助面板关闭 | 自动化 | `app:test/AiChatRightPanels.test.ts ›「打开辅助面板时灵感大全收起」`；`app:test/AiChatRightPanels.test.ts ›「辅助面板打开时点灵感大全：关闭辅助面板、展开灵感大全」`；`app:test/AiChatRightPanels.test.ts ›「灵感大全打开时点辅助面板：收起灵感大全、展开辅助面板」`；`app:test/AiChatRightPanels.test.ts ›「灵感大全收起后可以再次展开（不依赖辅助面板）」` | ✅ |
| FR-1.9 | 笔记有未保存修改时关闭辅助面板被拦截：灵感大全不展开，辅助面板保持打开并出现行内确认条 | 自动化 | `app:test/AiChatRightPanels.test.ts ›「笔记有未保存修改时点灵感大全：辅助面板保持打开，灵感不展开」` | ✅ |

### 3.2 FR-2 面板内布局

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| FR-2.1 | 辅助会话区与笔记区同时渲染，互不遮挡 | 自动化 | `app:test/AssistantPanel.test.ts ›「两个区域同时渲染（辅助会话区 + 笔记区）」`；`app:test/AssistantFlow.test.ts ›「同时显示该工作区的辅助会话与笔记列表」` | ✅ |
| FR-2.2 | 标题栏右侧有布局切换入口，点击在左右分栏 / 上下分栏之间切换 | 自动化 | `app:test/AssistantPanel.test.ts ›「默认左右分栏，切换后为上下分栏并持久化」` | ✅ |
| FR-2.3 | 布局写入 settings 的 `assistant.panelLayout`，重启后恢复 | 自动化 | `app:test/AssistantPanel.test.ts ›「从 settings 恢复已保存的宽度、布局与全屏状态」` | ✅ |
| FR-2.4 | 两区之间有可拖拽的内部分隔条，拖动改变比例 | 自动化 | `app:test/AssistantPanel.test.ts ›「内部分隔条可拖拽调整两区比例」` | 🔸 |
| FR-2.5 | 笔记区不提供独立于面板标题栏的折叠按钮 | 自动化 | `app:test/AssistantPanel.test.ts ›「标题栏有会话区与笔记区两个收起开关」` | ✅ |
| FR-2.6 | 两个子区各自可收起，收起即完全隐藏；只剩一个区时分隔条隐藏且剩下的区占满全部空间；两个都收起时整个面板隐藏 | 自动化 | `app:test/AssistantPanel.test.ts ›「收起会话区后该区隐藏，笔记区仍在，面板不隐藏」`；`app:test/AssistantPanel.test.ts ›「收起笔记区后该区隐藏，会话区仍在」`；`app:test/AssistantPanel.test.ts ›「只剩一个区时隐藏内部分隔条」`；`app:test/AssistantPanel.test.ts ›「两个子区都收起时整个面板隐藏」`；`app:test/AssistantPanel.test.ts ›「只剩一个区时，展开的那个区占满面板全部空间」` | ✅ |
| FR-2.7 | 面板重新打开时两个子区都展开；收起状态不持久化 | 自动化 | `app:test/AssistantPanel.test.ts ›「重新打开面板时两个子区都展开」`；`app:test/AssistantPanel.test.ts ›「收起状态不写入 settings」` | ✅ |

> FR-2.4 为 🔸：拖拽比例只在默认的左右分栏下断言过，上下分栏下的分隔条行为没有单独用例。
> FR-2.5 为 ✅：折叠开关统一放在面板标题栏，笔记区内不存在独立折叠按钮 —— 由「标题栏有会话区与笔记区两个收起开关」这条用例守住（两个开关都在标题栏）。

### 3.3 FR-3 辅助会话

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| FR-3.1 | 会话入口点击后展开下拉浮层，浮层列出全部辅助会话，当前激活项有高亮，点击可切换 | 自动化 | `app:test/AssistantFlow.test.ts ›「同时显示该工作区的辅助会话与笔记列表」`；`app:test/AssistantFlow.test.ts ›「激活项取自工作区状态」`；`app:test/AssistantFlow.test.ts ›「浮层列出全部辅助会话，点击后切换激活会话」`；`app:test/AssistantConversations.test.ts ›「切换会话时同步工作区激活项」` | ✅ |
| FR-3.2 | 新建的会话 `isAssistant = 1` 且 `scopeId` 指向当前工作区 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「assistant:create 建立的会话 isAssistant=1 且归属该工作区」`；`容器:test/assistant/assistantDb.test.ts ›「只返回指定工作区的辅助会话」` | ✅ |
| FR-3.3 | 辅助会话复用既有 `ai:chat` 流式通道，conversationId 传辅助会话 id | 自动化 | `app:test/AssistantConversations.test.ts ›「发送消息走既有 ai:chat 通道，conversationId 为辅助会话」`；`app:test/AssistantConversations.test.ts ›「流式回复完成后追加到消息列表」` | ✅ |
| FR-3.4 | 用户消息与 AI 回复由主进程持久化到 `messages` 表 | 自动化 | `app:test/AssistantConversations.test.ts ›「发送消息走既有 ai:chat 通道，conversationId 为辅助会话」`；`容器:test/assistant/assistantIpc.test.ts ›「assistant:getMessages 返回指定会话的消息」` | ✅ |
| FR-3.5 | 当前会话标题右侧有重命名图标，点击弹出改名框，确认后同步到主进程 | 自动化 | `app:test/AssistantFlow.test.ts ›「标题右侧的重命名按钮弹出改名框，确认后同步到主进程」`；`app:test/AssistantConversations.test.ts ›「重命名会话同步到主进程」`；`容器:test/assistant/assistantIpc.test.ts ›「assistant:rename 更新会话标题」` | ✅ |
| FR-3.6 | 会话顺序可拖拽调整，顺序持久化到 `ord`，读取时按 `ord` 升序 | 自动化 | `app:test/AssistantConversations.test.ts ›「拖拽排序后按新顺序持久化」`；`容器:test/assistant/assistantDb.test.ts ›「辅助会话按 ord 升序返回」`；`容器:test/assistant/assistantDb.test.ts ›「updateConversationOrd 改变 Tab 顺序」` | 🔸 |
| FR-3.7 | 删除辅助会话前有二次确认，确认后级联删除其消息 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「级联删除会话的消息，不留孤儿」`；`app:test/AssistantFlow.test.ts ›「删除后该会话从列表消失，该工作区的笔记保留」` | 🔸 |
| FR-3.8 | 删除辅助会话不删除该工作区的笔记 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「该工作区的笔记保留」`；`app:test/AssistantFlow.test.ts ›「删除后该会话从列表消失，该工作区的笔记保留」` | ✅ |

> FR-3.6 为 🔸：能力层（composable + IPC + DB）已验证，但**当前下拉浮层没有拖拽排序的 UI 入口**，交互形式待产品确认。
> FR-3.7 为 🔸：级联删消息已验证；二次确认框本身没有用例。

### 3.4 FR-4 笔记

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| FR-4.1 | 笔记区为「列表下拉 + 编辑器」结构：列表收在下拉浮层里（显示数量与标题、当前项高亮），编辑器常驻 | 自动化 | `app:test/AssistantNotes.test.ts ›「渲染笔记数量与每条笔记的标题」`；`app:test/AssistantNotes.test.ts ›「当前编辑的笔记高亮」` | 🔸 |
| FR-4.2 | 笔记存 `notes` 表，content 为 HTML 富文本 | 自动化 | `容器:test/assistant/assistantDb.test.ts ›「createNote 的 scopeId 正确落库」`；`容器:test/assistant/assistantDb.test.ts ›「updateNote 更新标题与正文」` | 🔸 |
| FR-4.3 | 标题可编辑，默认「新笔记」；改了标题进入未保存状态 | 自动化 | `app:test/AssistantNotes.test.ts ›「新建笔记 sourceType 为 manual，默认标题「新笔记」」`；`app:test/AssistantNotes.test.ts ›「标题输入框显示当前笔记标题」`；`app:test/AssistantNotes.test.ts ›「修改标题后进入未保存状态」` | ✅ |
| FR-4.4 | 编辑器工具栏有加粗、斜体、无序列表、有序列表、插入图片 URL 五个入口 | 人工 | `app:src/views/ai/components/assistant/AssistantNoteEditor.vue` | ⚠️ |
| FR-4.5 | 编辑过程不落库，点「保存」才写库；无修改时保存按钮禁用 | 自动化 | `app:test/AssistantNotes.test.ts ›「编辑过程不落库，只有点击保存才调用 update」`；`app:test/AssistantNotes.test.ts ›「没有修改时保存按钮禁用」`；`app:test/AssistantNotes.test.ts ›「点击保存才写入数据库」` | ✅ |
| FR-4.6 | 有未保存修改时切换笔记/关面板/切主会话，顶部出现行内确认条（保存/放弃/取消切换），默认焦点在保存；不弹 modal | 自动化 | `app:test/AssistantNotes.test.ts ›「有未保存修改时切换笔记出现行内确认条，而不是弹窗」`；`app:test/AssistantNotes.test.ts ›「点击「保存」后落库并继续切换」`；`app:test/AssistantNotes.test.ts ›「点击「放弃」丢弃草稿并继续切换」`；`app:test/AssistantNotes.test.ts ›「点击「取消切换」停留在原笔记」` | ✅ |
| FR-4.7 | 摘录时写入 `sourceConvTitle` / `sourceMsgContent` 快照，来源会话被删后笔记仍可读 | 自动化 | `app:test/AssistantConversations.test.ts ›「写入来源快照，且 scopeId 为工作区而非辅助会话」`；`容器:test/assistant/assistantIpc.test.ts ›「notes:create 携带快照字段时快照被持久化」` | ✅ |
| FR-4.8 | 手动创建笔记时 `sourceType = 'manual'` | 自动化 | `app:test/AssistantNotes.test.ts ›「新建笔记 sourceType 为 manual，默认标题「新笔记」」` | ✅ |
| FR-4.9 | 内容超过 1MB 拒绝写入并提示，编辑区内容保留 | 自动化 | `app:test/AssistantNotes.test.ts ›「超过 1MB 时拒绝写入并保留草稿」`；`容器:test/assistant/assistantIpc.test.ts ›「notes:update 内容超 1MB 时抛错且不落库」` | ✅ |
| FR-4.10 | 删除笔记需二次确认，确认后从列表移除 | 自动化 | `app:test/AssistantNotes.test.ts ›「确认后调用删除接口并从列表移除」`；`容器:test/assistant/assistantDb.test.ts ›「删除笔记同时清掉 FTS 记录」` | ✅ |

> FR-4.1 为 🔸：列表/高亮有断言，「列表在上、编辑器在下」的上下次序没有断言。
> FR-4.2 为 🔸：HTML 正文落库有断言，「图片通过 URL 引用」没有对应用例。

### 3.5 FR-5 搜索

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| FR-5.1 | 面板标题栏右侧有「搜索」入口，点击切换搜索面板显示 | 自动化 | `app:test/AssistantPanel.test.ts ›「搜索入口切换搜索面板的显示」`；`app:test/AssistantPanel.test.ts ›「搜索浮层锚在内容区，不遮挡头部按钮」` | ✅ |
| FR-5.2 | 搜索范围是全部工作区，类型覆盖笔记正文 + 对话消息正文 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「search:query 跨工作区同时命中笔记与消息」`；`容器:test/assistant/assistantDb.test.ts ›「搜索跨全部工作区」`；`app:test/AssistantSearch.test.ts ›「结果同时包含笔记与对话消息」` | ✅ |
| FR-5.3 | 结果按笔记/对话分组，每条显示所属主会话标题，匹配片段关键词高亮 | 自动化 | `app:test/AssistantSearch.test.ts ›「按类型分组显示数量」`；`app:test/AssistantSearch.test.ts ›「每条结果标注所属主会话标题」`；`app:test/AssistantSearch.test.ts ›「匹配片段中的关键词被高亮」`；`容器:test/assistant/assistantDb.test.ts ›「搜索结果标注来源主会话标题」` | ✅ |
| FR-5.4 | 点击结果可定位到目标笔记/消息并短暂高亮 | 自动化 | `app:test/AssistantSearch.test.ts ›「点击笔记结果携带工作区与笔记 id」`；`app:test/AssistantSearch.test.ts ›「点击对话结果携带会话与消息 id」` | 🔸 |
| FR-5.5 | 输入防抖 200ms，连续输入只发起一次查询，过期响应被丢弃 | 自动化 | `app:test/AssistantSearch.test.ts ›「防抖时长为 200ms」`；`app:test/AssistantSearch.test.ts ›「连续输入只在停顿后发起一次查询」`；`app:test/AssistantSearch.test.ts ›「过期请求的结果被丢弃」` | ✅ |
| FR-5.6 | 无结果时显示「没有找到匹配内容」 | 自动化 | `app:test/AssistantSearch.test.ts ›「没有结果时显示空态文案」` | ✅ |

> FR-5.4 为 🔸：用例只断言「结果点击后带出了定位所需的 id」，真实跳转（切主会话 → 定位目标 → 短暂高亮）只在端到端跑测中人工确认过，脚本未固化。

### 3.6 FR-6 工作区状态

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| FR-6.1 | 每个工作区独立记录当前激活的辅助会话与笔记，两项可分别置空 | 自动化 | `容器:test/assistant/assistantDb.test.ts ›「setWorkspaceActive 写入激活项后可读回」`；`容器:test/assistant/assistantDb.test.ts ›「setWorkspaceActive 可单独置空某一项」`；`app:test/AssistantConversations.test.ts ›「切换会话时同步工作区激活项」`；`app:test/AssistantNotes.test.ts ›「激活工作区状态里记录的那条笔记」` | ✅ |
| FR-6.2 | 切换主会话时辅助面板关闭，重新打开时加载该主会话的工作区状态；乱序响应不得串台 | 自动化 | `app:test/AiChatSwitchSession.test.ts ›「切换会话后面板关闭，主会话已切换」`；`app:test/AiChatSwitchSession.test.ts ›「切换会话时不再加载新工作区的数据（面板关闭，不触发加载）」`；`app:test/AssistantFlow.test.ts ›「scope 变化后重新加载该工作区的会话与笔记」`；`app:test/AssistantConversations.test.ts ›「按 scopeId 列出辅助会话并激活工作区记录的那一个」`；`app:test/AssistantConversations.test.ts ›「乱序加载时旧工作区的响应被丢弃，不写进新工作区的激活项」` | ✅ |
| FR-6.3 | 首次进入无历史状态的工作区时，自动创建一条辅助会话并激活 | 自动化 | `app:test/AssistantConversations.test.ts ›「工作区没有辅助会话时自动创建一条并激活」`；`容器:test/assistant/assistantIpc.test.ts ›「空工作区创建辅助会话并激活」` | ✅ |

### 3.7 FR-8 非功能需求

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| NFR-R1 | 多表写操作（会话 + 消息 + 笔记 + 状态）在单个事务内完成 | 人工 | `容器:electron/modules/ai/manager/index.ts` | ⚠️ |
| NFR-R2 | 删除手动按序执行，不依赖数据库外键自动级联 | 人工 | `容器:electron/modules/ai/manager/index.ts` | 🔸 |
| NFR-R3 | 写入后主动同步 FTS 索引，索引与主表不脱节 | 自动化 | `容器:test/assistant/assistantDb.test.ts ›「appendMessage 后 messages_fts 能搜到该消息」`；`容器:test/assistant/assistantDb.test.ts ›「更新笔记后 FTS 命中新内容、旧内容不再命中」`；`容器:test/assistant/assistantDb.test.ts ›「删除会话后 messages_fts 同步清除」`；`容器:test/assistant/assistantDb.test.ts ›「删除笔记同时清掉 FTS 记录」` | ✅ |
| NFR-R4 | 关闭面板、切换主会话都不触发任何数据删除 | 自动化 | `app:test/AssistantPanel.test.ts ›「关闭面板只隐藏，不触发任何数据写入」`；`容器:test/assistant/assistantDb.test.ts ›「两个工作区的数据互不干扰」` | 🔸 |
| NFR-R5 | 笔记保存失败（超限 / DB 错误）时保留编辑区内容，不清空草稿 | 自动化 | `app:test/AssistantNotes.test.ts ›「超过 1MB 时拒绝写入并保留草稿」`；`容器:test/assistant/assistantDb.test.ts ›「updateNote 内容超过 1MB 抛错且不落库」` | ✅ |
| NFR-S1 | 所有 SQL 参数化，注入串不破坏表结构 | 自动化 | `容器:test/assistant/assistantDb.test.ts ›「恶意 scopeId 不破坏表结构」`；`容器:test/assistant/assistantDb.test.ts ›「恶意 noteId 不破坏表结构」`；`容器:test/assistant/assistantIpc.test.ts ›「恶意 convId 不破坏表结构」` | ✅ |
| NFR-S2 | 笔记 content 渲染前过滤 `<script>` / `on*` 事件属性 / `javascript:` URL | 自动化 | `app:test/AssistantNotes.test.ts ›「NFR-S2 保存前过滤 script 标签与事件属性」`；`app:test/AssistantSearch.test.ts ›「先消毒再高亮，脚本标签不会残留」` | ✅ |
| NFR-S3 | 笔记 content 长度上限 1MB，超限拒绝写入并报错 | 自动化 | `容器:test/assistant/assistantDb.test.ts ›「createNote 内容超过 1MB 抛错」`；`容器:test/assistant/assistantIpc.test.ts ›「notes:update 内容超 1MB 时抛错且不落库」` | ✅ |
| NFR-S4 | 会话 / 笔记 ID 做格式校验，拒绝非预期字符 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「assistant:create 拒绝不存在的工作区」`；`容器:test/assistant/assistantIpc.test.ts ›「assistant:create 拒绝把辅助会话当作工作区」`；`容器:test/assistant/assistantIpc.test.ts ›「notes:delete 拒绝不存在的笔记」`；`容器:test/assistant/assistantIpc.test.ts ›「assistant:deleteSession 拒绝删除主会话」` | 🔸 |
| NFR-S5 | 搜索关键词转义后作为 FTS5 查询参数传入；FTS5 语法错误要捕获并降级为 LIKE 字面匹配 | 自动化 | `容器:test/assistant/assistantDb.test.ts ›「含 FTS 特殊字符的关键词不抛错」`；`容器:test/assistant/assistantIpc.test.ts ›「含特殊字符的关键词不抛错」`；`容器:test/assistant/assistantIpc.test.ts ›「短关键词的 LIKE 回退把 % 当字面量」` | 🔸 |
| NFR-P1 | 搜索走 FTS5 trigram 虚拟表；关键词 < 3 字符走 LIKE 回退（上限 20 条） | 自动化 | `容器:test/assistant/assistantDb.test.ts ›「中文关键词命中笔记，snippet 为原文片段」`；`容器:test/assistant/assistantDb.test.ts ›「1-2 字符关键词走 LIKE 回退仍能命中」` | ✅ |
| NFR-P2 | 搜索输入防抖 200ms | 自动化 | `app:test/AssistantSearch.test.ts ›「防抖时长为 200ms」` | ✅ |
| NFR-P3 | 笔记操作走独立 IPC channel，不阻塞 AI 流式推送 | 人工 | `容器:electron/modules/notes/handlers.ts` | ⚠️ |
| NFR-P4 | 消息列表按时间倒序分页加载，首屏最近 20 条 | — | — | ❌ |

> NFR-R1 为 ⚠️：事务边界在 `db.transaction()` 里，自动化测不到「中途失败不产生半截数据」，只能靠代码审查 + 人工构造失败场景。
> NFR-R2 / NFR-R4 / NFR-S4 / NFR-S5 为 🔸：结果的正确性有断言，但「不依赖外键」「不触发删除」「ID 字符集」「降级为 LIKE」这些实现约束本身没有对应断言。
> NFR-P3 为 ⚠️：通道确实独立（`notes:*` 与 `ai:chat` 互不阻塞），但主进程用同步 SQLite 驱动（better-sqlite3），一次笔记写入会同步占用事件循环，对流式推送仍有阻塞风险 —— 见 §4 缺口 3。
> NFR-P4 为 ❌：未实现。`getMessagesByConvId` 返回全部消息，主会话与辅助会话都没有分页。

### 3.8 FR-7 核心流程

| ID | 期望（可判定） | 验证方式 | 验证位置 | 状态 |
|----|----------------|---------|---------|------|
| FLOW-1 | 打开面板后加载该工作区的辅助会话、笔记与激活项 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「assistant:list 只返回该工作区的辅助会话」`；`容器:test/assistant/assistantIpc.test.ts ›「notes:list 只返回该工作区的笔记」`；`容器:test/assistant/assistantIpc.test.ts ›「workspace:getState 对未初始化工作区返回空状态」`；`app:test/AssistantFlow.test.ts ›「激活项取自工作区状态」` | ✅ |
| FLOW-2 | 辅助会话发消息 → 流式 → 用户与 AI 两条消息都落库 | 自动化 | `app:test/AssistantConversations.test.ts ›「流式回复完成后追加到消息列表」`；`容器:test/assistant/assistantDb.test.ts ›「appendMessage 后 messages_fts 能搜到该消息」` | 🔸 |
| FLOW-3 | 从 AI 回复摘录为笔记，快照字段写入，笔记出现在列表并被激活 | 自动化 | `app:test/AssistantFlow.test.ts ›「摘录后笔记进入笔记列表，来源快照写入主进程」`；`app:test/AssistantConversations.test.ts ›「摘录后笔记进入当前工作区的笔记列表」`；`容器:test/assistant/assistantIpc.test.ts ›「notes:create 携带快照字段时快照被持久化」` | ✅ |
| FLOW-4 | 编辑笔记 → 点「保存」→ 落库且 FTS 同步；超限拒绝且保留编辑内容 | 自动化 | `app:test/AssistantFlow.test.ts ›「保存后写入数据库」`；`容器:test/assistant/assistantDb.test.ts ›「更新笔记后 FTS 命中新内容、旧内容不再命中」`；`app:test/AssistantNotes.test.ts ›「超过 1MB 时拒绝写入并保留草稿」` | ✅ |
| FLOW-5 | 有未保存修改时切换，出现行内确认条；保存/放弃/取消三条路径行为正确 | 自动化 | `app:test/AssistantNotes.test.ts ›「有未保存修改时切换被挂起，等待用户确认」`；`app:test/AssistantNotes.test.ts ›「确认后执行挂起的动作」`；`app:test/AssistantNotes.test.ts ›「取消切换后挂起的动作不再执行」`；`app:test/AssistantNotes.test.ts ›「多个挂起动作排队而不是互相覆盖，确认后依次执行」` | ✅ |
| FLOW-6 | 切换主会话时关闭辅助面板，未保存修改先确认；重新打开后加载新工作区，两个工作区数据互不干扰 | 自动化 | `app:test/AiChatSwitchSession.test.ts ›「切换会话后面板关闭，主会话已切换」`；`app:test/AiChatSwitchSession.test.ts ›「笔记有未保存修改时先确认，保存后关闭面板并完成切换」`；`app:test/AiChatSwitchSession.test.ts ›「取消切换时面板保持打开，主会话不变」`；`app:test/AssistantFlow.test.ts ›「scope 变化后重新加载该工作区的会话与笔记」`；`容器:test/assistant/assistantIpc.test.ts ›「切换 scope 后各自只看到自己的数据」` | ✅ |
| FLOW-7 | 搜索并跳转：分组结果、标注来源、点击定位并高亮 | 自动化 | `app:test/AssistantSearch.test.ts ›「点击笔记结果携带工作区与笔记 id」`；`app:test/AssistantSearch.test.ts ›「点击对话结果携带会话与消息 id」` | 🔸 |
| FLOW-8 | 删除辅助会话：会话从列表消失、消息清空、笔记保留、激活项置空 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「级联删除会话的消息，不留孤儿」`；`容器:test/assistant/assistantIpc.test.ts ›「该工作区的笔记保留」`；`容器:test/assistant/assistantIpc.test.ts ›「删除后 activeConvId 被置空」` | ✅ |
| FLOW-9 | 删除主会话：级联清空辅助会话、消息、笔记、workspace_state，且不影响其他工作区 | 自动化 | `容器:test/assistant/assistantIpc.test.ts ›「清空其辅助会话与消息」`；`容器:test/assistant/assistantIpc.test.ts ›「清空其工作区的笔记」`；`容器:test/assistant/assistantIpc.test.ts ›「清空 workspace_state」`；`容器:test/assistant/assistantIpc.test.ts ›「不影响其他工作区」`；`容器:test/assistant/assistantIpc.test.ts ›「删除目录时同样清空其工作区，不留孤儿」` | ✅ |
| FLOW-10 | 拖拽宽度 / 全屏 / 布局切换都持久化，重启后恢复 | 自动化 | `app:test/AssistantPanel.test.ts ›「从 settings 恢复已保存的宽度、布局与全屏状态」`；`app:test/AssistantPanel.test.ts ›「settings 中没有记录时使用默认值」` | ✅ |
| FLOW-11 | 空工作区自动创建一条辅助会话并激活 | 自动化 | `app:test/AssistantConversations.test.ts ›「工作区没有辅助会话时自动创建一条并激活」`；`容器:test/assistant/assistantIpc.test.ts ›「空工作区创建辅助会话并激活」` | ✅ |
| FLOW-12 | 收起单个子区该区隐藏；两个都收起时整个面板隐藏；重开后都展开 | 自动化 | `app:test/AssistantPanel.test.ts ›「收起会话区后该区隐藏，笔记区仍在，面板不隐藏」`；`app:test/AssistantPanel.test.ts ›「两个子区都收起时整个面板隐藏」`；`app:test/AssistantPanel.test.ts ›「重新打开面板时两个子区都展开」` | ✅ |
| FLOW-13 | 打开辅助面板自动收起灵感大全；打开灵感大全自动关闭辅助面板；被未保存修改拦截时灵感不展开 | 自动化 | `app:test/AiChatRightPanels.test.ts ›「打开辅助面板时灵感大全收起」`；`app:test/AiChatRightPanels.test.ts ›「辅助面板打开时点灵感大全：关闭辅助面板、展开灵感大全」`；`app:test/AiChatRightPanels.test.ts ›「笔记有未保存修改时点灵感大全：辅助面板保持打开，灵感不展开」` | ✅ |

> FLOW-2 为 🔸：消息落库与流式追加有断言，「流中断 → 已落库部分保留、不回滚」这条异常分支没有用例（真实 AI 服务不稳定，自动化跑不稳定）。
> FLOW-7 为 🔸：搜索侧完整，真实跳转（切主会话 → 定位 → 高亮）没有固化用例。

---

## 4. 已知缺口

按「会不会让用户出事」排序，不按实现难度排序。

### 缺口 1 — NFR-P4 消息分页未实现（❌）

需求要求消息列表按时间倒序分页、首屏 20 条。实际实现里 `getMessagesByConvId` 一把梭返回全部消息（主会话和辅助会话都一样）。

- **影响**：长会话会一次性把整段历史塞进渲染进程，首屏变慢、内存占用随对话线性增长。这是需求里唯一一条**完全没实现**的非功能需求。
- **补齐方向**：`getMessagesByConvId(convId, limit, before?)` + IPC 透传 limit / cursor，渲染端滚动到底再取下一页；FTS 索引不受影响（它按内容匹配，不按加载顺序）。
- **注意**：改这个接口会同时影响主聊天区和辅助会话区，两边都要回归。

### 缺口 2 — 交互细节缺断言（FR-1.3 / FR-2.4 / FR-3.7 / FR-4.1 / FR-4.2 / FR-4.4 / FR-5.4）

这些需求的**主干行为**已经被覆盖，缺的是"不该发生的"和"次序"级别的断言：

| 需求 | 缺什么 |
|------|-------|
| FR-1.3 | 没有断言主聊天区在面板打开时确实收缩了（挤压 vs 覆盖是两种完全不同的体验） |
| FR-2.4 | 上下分栏下的内部分隔条没单独验证 |
| FR-3.7 | 二次确认框本身没断言，只断言到删除动作被派发 |
| FR-4.1 | 没有断言笔记列表收在下拉浮层里、编辑器常驻 |
| FR-4.2 | 「图片通过 URL 引用」没有对应用例 |
| FR-4.4 | 工具栏五个按钮一个都没有测试 |
| FR-5.4 | 真实跳转与短暂高亮没有固化用例 |

- **补齐方向**：这些基本都能在现有组件测试里加断言，不需要新架构。FR-4.4 和 FR-1.3 优先级最高（用户每天都会碰到，且坏了很难一眼看出来）。

### 缺口 3 — NFR-P3 存在真实阻塞风险（⚠️）

需求写的是「笔记操作走独立 IPC channel，不阻塞 AI 流式推送」。**通道确实是独立的**，但主进程用的是同步 SQLite 驱动（better-sqlite3）：一次笔记保存/删除会同步占住事件循环，而流式推送的分片回调也要跑在同一个事件循环上。

- **影响**：辅助会话正在流式输出时保存笔记，主进程会卡住几百毫秒（笔记体量越大越久），流式表现为「顿一下」。
- **补齐方向**：要么把笔记写入挪到 worker 线程；要么在流式进行中对笔记写入做延迟合并。这条要么改需求措辞（承认"轻微抖动"），要么改实现 —— 不能靠文档糊过去。

### 缺口 4 — 实现约束类需求没有断言（NFR-R1 / R2 / R4 / S4 / S5）

这类需求描述的是**怎么写**而不是**表现如何**，自动化断言天然别扭。当前策略是：行为结果用用例守住，实现约束靠代码审查 + 本文档登记。风险是 review 不到位时约束会被无声破坏。

- **补齐方向**：优先补 NFR-S4（ID 格式校验）—— 补一条"传非法字符的 id 应当被拒绝"的用例即可，性价比最高。NFR-R1（事务原子性）可以构造"删除到一半抛错"的场景来断言无半截数据。

### 缺口 5 — 人工验收项未固化为脚本（§5 清单）

下面这些依赖真实窗口交互或真实 AI 服务，目前只有人工验收记录，没有可重复执行的脚本：

1. 删除主会话的确认框要列出「关联辅助会话 N 个 / 笔记 M 条」（对应 AC-24）
2. 摘录时若选中了文字，优先摘录选中部分（对应 FR-5.x 的 US-4 补充行为）
3. 面板挤压主区的实际观感（FR-1.3）
4. 面板宽度拖拽的边界手感（400px / 70% 视口）
5. 真实 AI 服务下的流式输出与自动滚动（仅在底部才 auto-scroll）

- **补齐方向**：第 1、2 项可以补成组件用例（mock 掉确认框断言文案、mock 选区断言内容）；第 3~5 项适合固化成 CDP 端到端脚本。

---

## 5. 人工验收清单

自动化覆盖不到、或自动化断言太弱的部分，按步骤人工过一遍：

| 步骤 | 期望 |
|------|------|
| 打开 AI 聊天页 → 点顶部「辅助面板」 | 面板从右侧滑出，主聊天区变窄（被挤压，不是盖住） |
| 拖面板左边缘到最左 | 宽度停在 400px，不会更窄 |
| 拖面板左边缘到最右 | 宽度停在视口的 70% |
| 点全屏 | 面板占满主聊天区，主区消失；再点恢复 |
| 点布局切换 | 左右分栏 ↔ 上下分栏，两区内部分隔条都还能拖 |
| 在笔记区写点东西 → 关面板 → 重开 | 草稿提示仍在；选「保存」后落库 |
| 主会话 A 写笔记 → 切到主会话 B | 面板自动关闭；重新打开看到 B 的工作区，切回 A 笔记还在 |
| 搜「索引」 | 命中所有工作区的笔记与对话，按类型分组，每条标了来源主会话 |
| 点「辅助面板」→ 点「灵感大全」 | 辅助面板关闭、灵感大全展开；再点「辅助面板」，灵感大全收起 |
| 点一条搜索结果 | 跳到对应主会话，定位到目标并短暂高亮 |
| 删主会话 | 确认框列出将被删除的辅助会话数与笔记数；确认后整个工作区消失，其他工作区不受影响 |

---

## 6. 与需求文档 §10 的关系

需求文档 [ASSISTANT_PANEL.md](ASSISTANT_PANEL.md) 的 §10 验收标准里已经有一张「流程 → 测试用例」追溯矩阵。两份文档的分工：

| | 需求文档 §10 | 本文档 |
|---|-------------|--------|
| 覆盖粒度 | 流程级（FLOW）+ 验收点（AC-1 ~ AC-30） | 需求条目级（FR-x.y / NFR / FLOW） |
| 回答的问题 | 「验收时该检查什么」 | 「每条需求凭什么说它对了」 |
| 覆盖状态 | 没有 | 有（✅ / 🔸 / ⚠️ / ❌），并且由脚本强制同步 |
| 缺口管理 | 不记录 | §4 集中登记 |

**两份都要保留**：§10 是验收清单（人工拿着跑），本文是覆盖账本（防止需求被悄悄漏掉）。校验脚本以本文为准，反向核对需求文档。

---

## 7. 怎么保持本文不过期

1. 改需求 → 先改需求文档，然后在本文补对应行（脚本会拦住"需求没登记"）
2. 加测试 → 在本文把验证位置补上（脚本会拦住"引用了不存在的用例"）
3. 改了测试名 → 同步改本文的引用（脚本会拦住"引用失效"）
4. 声称某条需求做完了 → 状态改成 ✅ 且必须填验证位置（脚本会拦住"标绿无验证"）

改完跑一次：

```bash
node scripts/check-req-coverage.mjs
```

脚本输出形如：

```
需求覆盖检查
  需求文档：docs/ASSISTANT_PANEL.md
  用例文档：docs/AI_ASSISTANT_CASES.md

状态分布
  ✅ 有自动化验证   46
  🔸 部分覆盖       11
  ⚠️ 仅人工验收     6
  ❌ 未实现         1

RESULT: PASS
```

`RESULT: FAIL` 表示文档和代码对不上，需要先修文档（或补测试）。
