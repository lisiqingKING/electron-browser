<script setup lang="ts">
interface DownloadItem {
  id: string
  filename: string
  status: string
  receivedBytes: number
  totalBytes: number | null
  createdAt: number
  url: string
}

defineProps<{
  item: DownloadItem
}>()

const emit = defineEmits<{
  (e: 'pause', id: string): void
  (e: 'resume', id: string): void
  (e: 'openFile', id: string): void
}>()

function formatBytes(n: number | null): string {
  if (n == null) return '—'
  if (n === 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function progressPercent(item: DownloadItem): number {
  const total = item.totalBytes
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round((item.receivedBytes / total) * 100))
}

const statusLabel: Record<string, string> = {
  downloading: '下载中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
  queued: '排队中',
}

function fileIconColor(filename: string): { bg: string; fg: string } {
  const ext = (/\.([a-z0-9]+)$/i.exec(filename)?.[1] || '').toLowerCase()
  const img  = ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff']
  const vid  = ['mp4','mkv','avi','mov','wmv','flv','webm']
  const aud  = ['mp3','wav','flac','aac','ogg','wma','m4a']
  const doc  = ['pdf']
  const arc  = ['zip','rar','7z','tar','gz','bz2','xz']
  const code = ['js','ts','py','java','cpp','c','h','css','html','json','xml','yaml','yml','md','sh','bat']
  const sheet= ['xls','xlsx','csv','ods']
  const slide= ['ppt','pptx','odp']

  if (img.includes(ext))  return { bg: 'rgba(16, 185, 129, 0.12)',  fg: '#10b981' }
  if (vid.includes(ext))  return { bg: 'rgba(139, 92, 246, 0.12)', fg: '#8b5cf6' }
  if (aud.includes(ext))  return { bg: 'rgba(245, 158, 11, 0.12)',  fg: '#f59e0b' }
  if (doc.includes(ext))  return { bg: 'rgba(239, 68, 68, 0.12)',   fg: '#ef4444' }
  if (arc.includes(ext)) return { bg: 'rgba(245, 158, 11, 0.12)',  fg: '#f59e0b' }
  if (code.includes(ext)) return { bg: 'rgba(99, 102, 241, 0.12)',  fg: '#6366f1' }
  if (sheet.includes(ext)) return { bg: 'rgba(16, 185, 129, 0.12)',  fg: '#10b981' }
  if (slide.includes(ext)) return { bg: 'rgba(249, 115, 22, 0.12)',  fg: '#f97316' }
  return { bg: 'rgba(148, 163, 184, 0.12)', fg: '#94a3b8' }
}

function fileIconPath(filename: string): string {
  const ext = (/\.([a-z0-9]+)$/i.exec(filename)?.[1] || '').toLowerCase()
  const img  = ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff']
  const vid  = ['mp4','mkv','avi','mov','wmv','flv','webm']
  const aud  = ['mp3','wav','flac','aac','ogg','wma','m4a']
  const doc  = ['pdf']
  const arc  = ['zip','rar','7z','tar','gz','bz2','xz']
  const txt  = ['txt','log','ini','cfg','conf']

  if (img.includes(ext)) return 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'
  if (vid.includes(ext)) return 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z'
  if (aud.includes(ext)) return 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'
  if (doc.includes(ext)) return 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'
  if (arc.includes(ext)) return 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z'
  if (txt.includes(ext)) return 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'
  return 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'
}
</script>

<template>
  <div class="item" :class="`status-${item.status}`">
    <div class="file-icon" :style="{ background: fileIconColor(item.filename).bg }">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" :style="{ color: fileIconColor(item.filename).fg }">
        <path :d="fileIconPath(item.filename)" />
      </svg>
    </div>

    <div class="info">
      <div class="filename-row">
        <span class="filename" :title="item.filename">{{ item.filename }}</span>
      </div>
      <div class="meta">
        <span class="status-label" :class="`status-text-${item.status}`">{{ statusLabel[item.status] }}</span>
        <span class="meta-sep">·</span>
        <span class="time">{{ formatTime(item.createdAt) }}</span>
      </div>

      <div v-if="item.status === 'downloading' || item.status === 'paused'" class="progress">
        <div class="bar">
          <div class="fill" :style="{ width: progressPercent(item) + '%' }"></div>
        </div>
        <div class="progress-text">
          {{ formatBytes(item.receivedBytes) }} / {{ formatBytes(item.totalBytes) }}
        </div>
      </div>
    </div>

    <div class="actions">
      <template v-if="item.status === 'downloading'">
        <button class="action-btn" title="暂停" @click.stop="emit('pause', item.id)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
      </template>
      <template v-else-if="item.status === 'paused'">
        <button class="action-btn" title="继续" @click.stop="emit('resume', item.id)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </template>
      <template v-else-if="item.status === 'completed'">
        <button class="action-btn" title="打开文件" @click.stop="emit('openFile', item.id)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.1s;
  margin-bottom: 4px;
  height: 64px;
  box-sizing: border-box;
}

.item:last-child {
  margin-bottom: 0;
}

.item:hover {
  background: var(--tabbar-hover-bg);
}

.file-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filename-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filename {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.status-label { font-weight: 500; }
.status-text-downloading { color: var(--color-accent); }
.status-text-paused       { color: var(--color-status-warning); }
.status-text-completed    { color: var(--color-status-success); }
.status-text-failed       { color: var(--color-status-error); }
.status-text-canceled     { color: var(--color-text-tertiary); }
.status-text-queued       { color: var(--color-text-tertiary); }

.meta-sep { color: var(--color-text-tertiary); }

.progress {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.bar {
  width: 100%;
  height: 3px;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
  border-radius: 2px;
}

.status-completed .fill { background: var(--color-status-success); }
.status-paused .fill    { background: var(--color-status-warning); }

.progress-text {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.action-btn:hover {
  background: var(--tabbar-hover-bg);
  color: var(--color-text-primary);
}

.action-btn.danger:hover {
  color: var(--color-status-error);
}
</style>
