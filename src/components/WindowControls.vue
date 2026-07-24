<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isMaximized = ref(false)

const handleMinimize = () => {
  window.ipcRenderer.invoke('window:minimize')
}

const handleMaximize = () => {
  window.ipcRenderer.invoke('window:maximize')
}

const handleClose = () => {
  window.ipcRenderer.invoke('window:close')
}

const onMaximizeChanged = (_event: Electron.IpcRendererEvent, maximized: boolean) => {
  isMaximized.value = maximized
}

onMounted(async () => {
  isMaximized.value = await window.ipcRenderer.invoke('window:isMaximized')
  window.ipcRenderer.on('window:maximize-changed', onMaximizeChanged)
})

onUnmounted(() => {
  window.ipcRenderer.removeListener('window:maximize-changed', onMaximizeChanged)
})
</script>

<template>
  <div class="window-controls">
    <button class="window-btn" title="最小化" @click="handleMinimize">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19 13H5v-2h14v2z"/>
      </svg>
    </button>
    <button class="window-btn" :title="isMaximized ? '还原' : '最大化'" @click="handleMaximize">
      <svg v-if="!isMaximized" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="4" y="4" width="16" height="16" rx="1"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="8" y="4" width="12" height="12" rx="1"/>
        <path d="M8 8H4v12h12v-4"/>
      </svg>
    </button>
    <button class="window-btn close" title="关闭" @click="handleClose">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  align-items: flex-end;
  flex-shrink: 0;
  height: 100%;
  padding: 0 12px 4px 12px;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.window-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #9aa0a6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s ease, color 0.1s ease;
}

.window-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e8eaed;
}

.window-btn.close:hover {
  background: #c42b1c;
  color: white;
}
</style>
