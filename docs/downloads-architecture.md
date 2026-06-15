# 下载管理器架构

主进程 `electron/downloads/` 模块的可视化说明。三张图分别覆盖：状态正确性、IPC 时序、模块耦合。

---

## 1. 状态机

**看什么**：状态转移是否完整、init 迁移是否覆盖所有 case、终态是否只有 3 个。

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> downloading : pump 选中
    downloading --> completed : 流结束
    downloading --> paused : 暂停
    downloading --> canceled : 取消
    downloading --> failed : 网络错误
    paused --> queued : 继续
    canceled --> queued : 重新下载
    failed --> queued : 重新下载

    queued --> paused : init 迁移
    downloading --> paused : init 迁移
    canceled --> paused : init 清洗 (老 bug 数据)

    completed --> [*]
    canceled --> [*]
    failed --> [*]
```

**关键点**：
- 6 个状态里 3 个非终态（queued / downloading / paused）+ 3 个终态（completed / canceled / failed）
- 任意非终态 → 终态 的转移都来自 `downloadScheduler` 的 catch 块
- init 时把 in-flight (queued/downloading) 一律转 paused，避免静默后台下载

---

## 2. IPC 时序

**看什么**：事件顺序、节流时序、错误分支是否到位、竞态点在哪。

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant WV as Webview
    participant SES as Session<br/>(main)
    participant MGR as Manager
    participant SCH as Scheduler
    participant SRC as httpSource
    participant NOT as Notifier
    participant DB as SQLite
    participant RD as Renderer
    participant UI as DownloadsPage

    User->>WV: 点击 <a download>
    WV->>SES: will-download
    SES->>SES: preventDefault (拦截)
    SES->>MGR: addHttpTask
    MGR->>DB: INSERT
    MGR->>NOT: emitAdded
    MGR->>SCH: pump()

    SCH->>DB: setStatus downloading
    SCH->>NOT: emitProgress (immediate)
    NOT-->>RD: progress event
    RD->>UI: 状态/进度

    SCH->>SRC: downloadHttpTask

    loop 字节流
        SRC-->>SCH: onProgress
        SCH->>NOT: recordChunk
        Note over NOT: 250ms 节流<br/>4Hz emit<br/>2s 速度窗口
        NOT-->>RD: progress (4Hz)
        NOT->>DB: flushNow (250ms)
    end

    SRC-->>SCH: resolve
    SCH->>DB: setStatus completed
    SCH->>NOT: finishTask
    NOT-->>RD: progress
    RD->>UI: 按钮组切换

    alt 暂停
        User->>UI: click 暂停
        UI->>MGR: pause
        MGR->>SCH: ac.abort user-paused
        SCH->>DB: setStatus paused
        SCH->>NOT: finishTask
        NOT-->>RD: progress
    else 取消 (无 in-flight)
        User->>UI: click 取消
        UI->>MGR: cancel
        MGR->>DB: setStatus canceled
        MGR->>NOT: finishTask
        NOT-->>RD: progress
    end
```

**关键点**：
- `event.preventDefault()` 在 SES 层就把 Chromium 拦掉，主进程自己拉
- 状态变更（downloading/paused/canceled/completed）走 `emitProgress` **immediate** 路径，不被 250ms 节流
- 字节流进度走 `recordChunk` → `scheduleProgressEmit` 节流路径
- 取消分两条路：in-flight 走 abort catch 块；非 in-flight（queued/paused）走 manager 直 setStatus

---

## 3. 模块依赖

**看什么**：耦合方向是否单向、数据归属是否清晰、抽象层有没有冗余。

```mermaid
flowchart TB
    subgraph Main[主进程]
        WV[webviewSource<br/>will-download 拦截]
        MGR[DownloadManager<br/>Facade 单例]
        SCH[Scheduler<br/>5 并发 + AbortController]
        ST[TaskStore<br/>内存 Map]
        NOT[Notifier<br/>4Hz 节流 + 2s 速度]
        TASK[DownloadTask<br/>内存模型 + 自身 DB 写]
        DB[(SQLite)]
        FS[文件系统]
    end

    subgraph IPCLayer[IPC 层]
        HND[downloadHandlers]
        CH[channels]
        PRX[createDownloadsProxy]
        BR[broadcast]
    end

    subgraph Renderer[渲染层]
        USE[useDownloads]
        PG[DownloadsPage]
    end

    WV -->|addHttpTask| MGR
    MGR --> ST
    MGR --> SCH
    MGR --> NOT
    SCH -->|pick/start/cancel/pause| ST
    SCH --> SRC[httpSource]
    SCH -->|setStatus/finishTask| NOT
    ST --> TASK
    TASK -->|setStatus/setProgress| DB
    NOT -->|emit| BR
    MGR -->|remove/clearAll| FS

    HND --> MGR
    HND --> CH
    PRX --> CH
    BR -.->|downloads:event| PRX

    USE --> PRX
    USE --> BR
    PG --> USE
```

**关键点**：
- Manager 是唯一对外入口，Store/Scheduler/Notifier 之间不互相调用，都走 Manager 编排
- 数据归属：`DownloadTask` 自己写回 DB（避免 store 中转的间接层），Store 只管 list-level 增删查
- IPC 三层：handler (主) → channel (常量) → proxy (preload)，render 端看不到 push channel
- 渲染层 `useDownloads` 只持 proxy + event 订阅，event 流驱动 `tasks[]` 和 `progressMap`，不主动 refetch
