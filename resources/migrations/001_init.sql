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

CREATE TABLE IF NOT EXISTS tabs (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL,
    url         TEXT    NOT NULL,
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
