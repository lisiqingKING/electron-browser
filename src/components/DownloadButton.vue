<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const downloadsMod = window.bridge.getModules(['downloads']).downloads

interface ActiveDownload {
  id: string
  receivedBytes: number
  totalBytes: number | null
  status: string
  updatedAt: number
}

const activeDownloads = new Map<string, ActiveDownload>()
const downloadProgress = ref(0)

function updateProgress() {
  if (activeDownloads.size === 0) {
    downloadProgress.value = 0
    return
  }

  // 优先选择 downloading，相同则选更新时间最新的
  let selected: ActiveDownload | null = null
  for (const ad of activeDownloads.values()) {
    if (ad.status === 'downloading') {
      if (!selected || ad.updatedAt > selected.updatedAt) {
        selected = ad
      }
    }
  }
  if (!selected) {
    for (const ad of activeDownloads.values()) {
      if (ad.status === 'paused') {
        if (!selected || ad.updatedAt > selected.updatedAt) {
          selected = ad
        }
      }
    }
  }

  if (selected && selected.totalBytes && selected.totalBytes > 0) {
    downloadProgress.value = Math.round((selected.receivedBytes / selected.totalBytes) * 100)
  } else {
    downloadProgress.value = 0
  }
}

function onDownloadAdded(task: any) {
  activeDownloads.set(task.id, {
    id: task.id,
    receivedBytes: task.receivedBytes || 0,
    totalBytes: task.totalBytes,
    status: task.status,
    updatedAt: Date.now(),
  })
  updateProgress()
}

function onDownloadProgress(progress: any) {
  const ad = activeDownloads.get(progress.id)
  if (ad) {
    ad.receivedBytes = progress.receivedBytes
    ad.totalBytes = progress.totalBytes ?? ad.totalBytes
    ad.status = progress.status
    ad.updatedAt = Date.now()
    updateProgress()
  }
}

function onDownloadRemoved(id: string) {
  activeDownloads.delete(id)
  updateProgress()
}

function handleClick(event: MouseEvent) {
  const popupMod = window.bridge.getModules(['popup']).popup
  popupMod.show({
    x: event.screenX - 360,
    y: event.screenY + 10,
    component: 'DownloadsPopup',
    props: {},
  })
}

onMounted(async () => {
  // 初始化
  try {
    const list = await downloadsMod.list()
    for (const task of list || []) {
      if (task.status === 'downloading' || task.status === 'paused') {
        activeDownloads.set(task.id, {
          id: task.id,
          receivedBytes: task.receivedBytes || 0,
          totalBytes: task.totalBytes,
          status: task.status,
          updatedAt: Date.now(),
        })
      }
    }
    updateProgress()
  } catch {}

  // 订阅事件
  downloadsMod.onAdded(onDownloadAdded)
  downloadsMod.onProgress(onDownloadProgress)
  downloadsMod.onRemoved(onDownloadRemoved)
})

onUnmounted(() => {
  downloadsMod.removeOnAdded(onDownloadAdded)
  downloadsMod.removeOnProgress(onDownloadProgress)
  downloadsMod.removeOnRemoved(onDownloadRemoved)
})
</script>

<template>
  <button class="download-btn" title="下载" @click="handleClick">
    <svg v-if="downloadProgress > 0" class="progress-ring" viewBox="0 0 32 32" width="26" height="26">
      <circle class="progress-ring-bg" cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" stroke-width="2" />
      <circle
        class="progress-ring-fill"
        cx="16" cy="16" r="13.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        :stroke-dasharray="`${(downloadProgress / 100) * 84.82} 84.82`"
        transform="rotate(-90 16 16)"
      />
    </svg>
    <svg class="download-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
  </button>
</template>

<style scoped>
.download-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  color: var(--urlbar-icon);
  position: relative;
  transition: color 0.2s, transform 0.2s;

  &:hover {
    color: var(--urlbar-icon-hover);
  }

  &:active {
    transform: scale(0.95);
  }
}

.progress-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-accent);
}

.progress-ring-bg {
  opacity: 0.2;
}

.progress-ring-fill {
  transition: stroke-dasharray 0.3s ease;
}

.download-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
