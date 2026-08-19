<script setup lang="ts">
import { usePopup } from '../composables/usePopup'

const props = defineProps<{
  modelValue: string
  canGoBack?: boolean
  canGoForward?: boolean
  isFavorited?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'goBack'): void
  (e: 'goForward'): void
  (e: 'add'): void
  (e: 'openAI'): void
  (e: 'toggleFavorite'): void
}>()

const { show } = usePopup()

const handleRefresh = () => {
  window.ipcRenderer.send('tabs:refresh')
}

const handleGoBack = () => {
  if (props.canGoBack) emit('goBack')
}

const handleGoForward = () => {
  if (props.canGoForward) emit('goForward')
}

const handleMoreClick = (event: MouseEvent) => {
  show({
    x: event.screenX,
    y: event.screenY,
    component: 'UrlBarMoreMenu',
    props: { currentUrl: props.modelValue },
  })
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

      <button class="star-btn" :class="{ active: props.isFavorited }" title="收藏" @click="emit('toggleFavorite')">
        <svg viewBox="0 0 24 24" width="18" height="18" :fill="props.isFavorited ? '#facc15' : 'currentColor'">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      </button>
      <button class="ai-btn" title="AI 助手" @click="emit('openAI')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>
        </svg>
      </button>
      <button class="more-btn" title="更多" @click="handleMoreClick">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.url-bar {
  padding: 0 12px;
  height: 48px;
  width: 100%;
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
  height: 100%;
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
  height: 34px;
  padding: 0 12px;
  min-width: 0;
  background: var(--urlbar-input-bg);
  border-radius: 20px;
  border: 1px solid var(--urlbar-input-border);
  margin: 0 8px;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.url-input-wrap:focus-within {
  border-color: var(--urlbar-input-border-focus);
  box-shadow: 0 0 0 1px var(--urlbar-input-border-focus);
}

.security-icon {
  flex-shrink: 0;
  opacity: 0.7;
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

/* ── 更多按钮 ── */
.more-btn {
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

.more-btn:hover {
  background: var(--window-btn-hover);
  color: var(--urlbar-icon-hover);
}

.more-btn:active {
  background: var(--window-btn-hover);
}

/* ── AI 助手按钮 ── */
.ai-btn {
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

.ai-btn:hover {
  background: var(--window-btn-hover);
  color: var(--urlbar-icon-hover);
}

.ai-btn:active {
  background: var(--window-btn-hover);
}

/* ── 收藏按钮 ── */
.star-btn {
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

.star-btn:hover {
  background: var(--window-btn-hover);
  color: var(--urlbar-icon-hover);
}

.star-btn:active {
  background: var(--window-btn-hover);
}

.star-btn.active {
  color: #facc15;
}
</style>
