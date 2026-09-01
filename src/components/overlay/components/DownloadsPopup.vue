<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import DownloadItemRow from './DownloadItemRow.vue'

const props = defineProps<{
  windowId?: number
}>()

const downloadsMod = window.bridge.getModules(['downloads']).downloads
const tabsMod = window.bridge.getModules(['tabs']).tabs

interface DownloadItem {
  id: string
  filename: string
  status: string
  receivedBytes: number
  totalBytes: number | null
  createdAt: number
  url: string
}

const downloads = ref<DownloadItem[]>([])
const loading = ref(true)

async function loadDownloads() {
  try {
    const list = await downloadsMod.list()
    downloads.value = (list || []).slice(0, 5)
  } catch {
    downloads.value = []
  } finally {
    loading.value = false
  }
}

function onTaskAdded(task: any) {
  const idx = downloads.value.findIndex(d => d.id === task.id)
  if (idx >= 0) {
    downloads.value[idx] = task
  } else {
    downloads.value = [task, ...downloads.value.slice(0, 4)]
  }
}

function onProgress(progress: any) {
  const idx = downloads.value.findIndex(d => d.id === progress.id)
  if (idx >= 0) {
    downloads.value[idx] = {
      ...downloads.value[idx],
      status: progress.status,
      receivedBytes: progress.receivedBytes,
      totalBytes: progress.totalBytes ?? downloads.value[idx].totalBytes,
    }
  } else {
    // 找不到任务时刷新列表
    loadDownloads()
  }
}

function onRemoved(id: string) {
  const idx = downloads.value.findIndex(d => d.id === id)
  if (idx >= 0) {
    downloads.value.splice(idx, 1)
  }
}

function hide() {
  window.bridge.send('popup:hide')
}

function openDownloadsPage() {
  tabsMod.createDownloads(undefined, props.windowId)
  hide()
}

async function onPause(id: string) {
  await downloadsMod.pause(id)
  await loadDownloads()
}

async function onResume(id: string) {
  await downloadsMod.resume(id)
  await loadDownloads()
}

async function onOpenFile(id: string) {
  await downloadsMod.openFile(id)
}

onMounted(() => {
  loadDownloads()
  downloadsMod.onAdded(onTaskAdded)
  downloadsMod.onProgress(onProgress)
  downloadsMod.onRemoved(onRemoved)
})

onUnmounted(() => {
  downloadsMod.removeOnAdded(onTaskAdded)
  downloadsMod.removeOnProgress(onProgress)
  downloadsMod.removeOnRemoved(onRemoved)
})
</script>

<template>
  <div class="downloads-popup">
    <div class="header">
      <span class="title">最近下载</span>
      <button class="open-page-btn" @click="openDownloadsPage">查看全部</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="downloads.length === 0" class="empty">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" class="empty-icon">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
      </svg>
      <span class="empty-text">暂无下载记录</span>
    </div>

    <div v-else class="list">
      <DownloadItemRow
        v-for="item in downloads"
        :key="item.id"
        :item="item"
        @pause="onPause"
        @resume="onResume"
        @openFile="onOpenFile"
      />
    </div>
  </div>
</template>

<style scoped>
.downloads-popup {
  width: 360px;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.open-page-btn {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.1s;
}

.open-page-btn:hover {
  background: var(--tabbar-hover-bg);
}

.loading, .empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  opacity: 0.4;
}

.list {
  padding: 6px 8px;
}
</style>
