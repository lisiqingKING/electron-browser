-- 001: 完整初始表结构
-- 以后结构变更新增 migration 文件

CREATE TABLE IF NOT EXISTS page_icons (
    url         TEXT    PRIMARY KEY,
    icon        TEXT    NOT NULL,
    iconUrl     TEXT,
    updatedAt   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_page_icons_url ON page_icons(url);

CREATE TABLE IF NOT EXISTS history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    visitedAt   INTEGER NOT NULL,
    favicon     TEXT
);

CREATE TABLE IF NOT EXISTS favorites (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT    NOT NULL UNIQUE,
    title       TEXT    NOT NULL DEFAULT '',
    favicon     TEXT,
    createdAt   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_favorites_url ON favorites(url);

CREATE TABLE IF NOT EXISTS ai_conversation (
    convId      TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL DEFAULT '新会话',
    messages    TEXT    NOT NULL DEFAULT '[]',
    createdAt   INTEGER NOT NULL,
    updatedAt   INTEGER NOT NULL,
    pinned      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cache (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS tabs (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    favicon     TEXT,
    createdAt   INTEGER NOT NULL,
    updatedAt   INTEGER NOT NULL,
    isHome      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS window_config (
    windowId    TEXT    PRIMARY KEY,
    currentTabId TEXT
);

CREATE TABLE IF NOT EXISTS downloads (
    id              TEXT    PRIMARY KEY,
    url             TEXT    NOT NULL,
    method          TEXT    NOT NULL DEFAULT 'GET',
    post_body       TEXT,
    headers         TEXT    NOT NULL DEFAULT '{}',
    filename        TEXT    NOT NULL,
    save_dir        TEXT    NOT NULL,
    total_bytes     INTEGER,
    received_bytes  INTEGER NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL,
    error           TEXT,
    referrer        TEXT,
    mime_type       TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC);

-- AI 流式聊天表（规范化 schema）
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL DEFAULT '新对话',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT    PRIMARY KEY,
    conversation_id TEXT    NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'sending',
    halt_reason     TEXT,
    model           TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
