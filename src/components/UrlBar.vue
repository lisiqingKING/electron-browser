<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

const handleRefresh = () => {
  window.ipcRenderer.send('tabs:refresh')
}
</script>

<template>
  <div class="url-bar">
    <div class="url-bar-container">
      <div class="nav-buttons">
        <button class="nav-btn" title="后退">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <button class="nav-btn" title="前进">
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
          <button class="action-btn" title="收藏">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
          <button class="action-btn" title="更多">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
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
  background: #1a1a1a;
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
