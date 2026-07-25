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
  (e: 'openSettings'): void
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
    <div class="url-bar-inner">
      <div class="nav-buttons">
        <button class="nav-btn" :class="{ disabled: !canGoBack }" title="后退" @click="handleGoBack">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <button class="nav-btn" :class="{ disabled: !canGoForward }" title="前进" @click="handleGoForward">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
          </svg>
        </button>
        <button class="nav-btn" title="刷新" @click="handleRefresh">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>

      <div class="url-input-wrap">
        <svg class="security-icon" viewBox="0 0 24 24" width="14" height="14" fill="#9aa0a6">
          <template v-if="props.modelValue.startsWith('https')">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </template>
          <template v-else>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.48 0-8-3.58-8-8s3.52-8 8-8 8 3.58 8 8-3.52 8-8 8zm-1-4h2v2h-2zm0-2h2V7h-2z"/>
          </template>
        </svg>
        <input
          :value="props.modelValue"
          type="text"
          placeholder="搜索或输入网址"
          class="url-input"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="emit('submit')"
        />
      </div>

      <button class="history-btn" title="历史" @click="emit('openHistory')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
        </svg>
      </button>

      <button class="settings-btn" title="设置" @click="emit('openSettings')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.url-bar {
  padding: 0 12px;
  height: 48px;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--urlbar-bg);
}

.url-bar-inner {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 34px;
}

/* ── 导航按钮 ── */
.nav-buttons {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 1px;
}

.nav-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--urlbar-icon);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s ease, color 0.12s ease;
}

.nav-btn:hover {
  background: var(--window-btn-hover);
  color: var(--urlbar-icon-hover);
}

.nav-btn:active {
  background: var(--window-btn-hover);
}

.nav-btn.disabled {
  color: var(--urlbar-icon-disabled);
  cursor: default;
  pointer-events: none;
}

/* ── 地址输入区 ── */
.url-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 12px;
  min-width: 0;
  background: var(--urlbar-input-bg);
  border-radius: 20px;
  border: 1px solid var(--urlbar-input-border);
  margin: 0 8px;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.url-input-wrap:hover {
  background: var(--urlbar-input-bg);
}

.url-input-wrap:focus-within {
  background: var(--urlbar-input-bg);
  border-color: var(--urlbar-input-border-focus);
  box-shadow: 0 0 0 1px var(--urlbar-input-border-focus);
}

.security-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.url-input-wrap:focus-within .security-icon {
  opacity: 1;
}

.url-input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  min-width: 0;
}

.url-input::placeholder {
  color: var(--color-text-tertiary);
}

/* ── 历史按钮 ── */
.history-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--urlbar-icon);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s ease, color 0.12s ease;
}

.history-btn:hover {
  background: var(--window-btn-hover);
  color: var(--urlbar-icon-hover);
}

.history-btn:active {
  background: var(--window-btn-hover);
}

/* ── 设置按钮 ── */
.settings-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--urlbar-icon);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s ease, color 0.12s ease;
}

.settings-btn:hover {
  background: var(--window-btn-hover);
  color: var(--urlbar-icon-hover);
}

.settings-btn:active {
  background: var(--window-btn-hover);
}
</style>
