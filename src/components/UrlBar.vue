<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  canGoBack?: boolean
  canGoForward?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'goBack'): void
  (e: 'goForward'): void
  (e: 'openHistory'): void
  (e: 'add'): void
}>()

const handleRefresh = () => {
  window.ipcRenderer.send('tabs:refresh')
}

const handleGoBack = () => {
  if (props.canGoBack) emit('goBack')
}

const handleGoForward = () => {
  if (props.canGoForward) emit('goForward')
}
</script>

<template>
  <div class="url-bar">
    <div class="url-bar-container">
      <div class="nav-buttons">
        <button class="nav-btn" :class="{ disabled: !canGoBack }" title="后退" @click="handleGoBack">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <button class="nav-btn" :class="{ disabled: !canGoForward }" title="前进" @click="handleGoForward">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
          </svg>
        </button>
        <button class="nav-btn" title="刷新" @click="handleRefresh">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>
      <div class="url-input-container">
        <div class="security-icon" v-if="props.modelValue.startsWith('https')">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="#5f6368">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
        </div>
        <div class="security-icon" v-else>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="#5f6368">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.48 0-8-3.58-8-8s3.52-8 8-8 8 3.58 8 8-3.52 8-8 8zm-1-4h2v2h-2zm0-2h2V7h-2z"/>
          </svg>
        </div>
        <input
          :value="props.modelValue"
          type="text"
          placeholder="搜索或输入网址"
          class="url-input"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="emit('submit')"
        />
        <div class="url-actions">
          <button class="action-btn" title="历史" @click="emit('openHistory')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
            </svg>
          </button>
          <button class="action-btn" title="新建标签页" @click="emit('add')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.url-bar {
  padding: 6px 16px;
  height: 40px;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #35363a;
  position: relative;
  z-index: 0;
}

.url-bar-container {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: 720px;
  height: 28px;
}

.nav-buttons {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.nav-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #9aa0a6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8eaed;
  border-radius: 6px;
}

.nav-btn.disabled {
  color: #5f6368;
  cursor: not-allowed;
}

.url-input-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 10px;
  background: #2d2d2d;
  border-radius: 14px;
  border: 1px solid transparent;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.url-input-container:focus-within {
  border-color: #1a73e8;
  box-shadow: 0 1px 6px rgba(32, 33, 36, 0.3);
}

.security-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.url-input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  color: #e8eaed;
  font-size: 13px;
  outline: none;
  min-width: 0;
}

.url-input::placeholder {
  color: #5f6368;
}

.url-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #5f6368;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8eaed;
  border-radius: 6px;
}
</style>
