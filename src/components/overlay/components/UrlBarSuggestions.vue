<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface SuggestionItem {
  type: 'favorite' | 'history'
  id: number
  url: string
  title: string
  favicon?: string
}

const props = defineProps<{
  favorites: SuggestionItem[]
  history: SuggestionItem[]
  inputValue?: string
}>()

const emit = defineEmits<{
  (e: 'action', action: string, context?: any): void
  (e: 'update:modelValue', value: string): void
}>()

const selectedIndex = ref(-1)
const localInputValue = ref(props.inputValue || '')

const filteredItems = computed(() => {
  const query = localInputValue.value.toLowerCase().trim()
  if (!query) return []

  const favs = (props.favorites ?? []).filter(
    item => item.title.toLowerCase().includes(query) || item.url.toLowerCase().includes(query)
  )
  const hist = (props.history ?? []).filter(
    h => !favs.some(f => f.url === h.url) &&
         (h.title.toLowerCase().includes(query) || h.url.toLowerCase().includes(query))
  )
  return [...favs, ...hist].slice(0, 10)
})

const hasSearchOption = computed(() => {
  return localInputValue.value.trim().length > 0
})

function hide() {
  window.bridge.send('popup:hide')
}

function selectItem(item: SuggestionItem) {
  emit('action', 'select', { url: item.url, title: item.title })
  hide()
}

function doSearch() {
  const query = localInputValue.value.trim()
  if (query) {
    emit('action', 'search', { query })
    hide()
  }
}

function handleInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  localInputValue.value = value
  emit('update:modelValue', value)
  selectedIndex.value = -1
}

function handleKeyDown(e: KeyboardEvent) {
  const items = filteredItems.value
  const totalItems = items.length + (hasSearchOption.value ? 1 : 0)
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, totalItems - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
      break
    case 'Enter':
      if (selectedIndex.value >= 0) {
        if (selectedIndex.value < items.length) {
          selectItem(items[selectedIndex.value])
        } else if (hasSearchOption.value) {
          doSearch()
        }
      } else if (localInputValue.value.trim()) {
        // 没有选中任何项目但有输入内容，执行搜索
        doSearch()
      }
      break
    case 'Escape':
      hide()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="suggestions">
    <div class="input-wrap">
      <svg class="security-icon" viewBox="0 0 24 24" width="14" height="14" fill="#9aa0a6">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
      </svg>
      <input
        :value="localInputValue"
        type="text"
        class="suggest-input"
        placeholder="搜索或输入网址"
        @input="handleInput"
        @keydown="handleKeyDown"
        @mousedown.stop
      />
    </div>
    <div class="list-wrap">
      <div
        v-for="(item, index) in filteredItems"
        :key="item.id"
        class="suggestion-item"
        :class="{ selected: index === selectedIndex }"
        @mousedown.stop="selectItem(item)"
        @mouseenter="selectedIndex = index"
      >
        <img v-if="item.favicon" :src="item.favicon" class="favicon" />
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="favicon-placeholder">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        <div class="info">
          <div class="title">{{ item.title || item.url }}</div>
          <div class="url">{{ item.url }}</div>
        </div>
        <span v-if="item.type === 'favorite'" class="badge">★</span>
      </div>
      <div
        v-if="hasSearchOption"
        class="suggestion-item search-item"
        :class="{ selected: selectedIndex === filteredItems.length }"
        @mousedown.stop="doSearch"
        @mouseenter="selectedIndex = filteredItems.length"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="favicon-placeholder">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <div class="info">
          <div class="title">搜索 "{{ localInputValue }}"</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.suggestions {
  display: flex;
  flex-direction: column;
  padding: 4px;
}

.list-wrap {
  max-height: 320px;
  overflow-y: auto;
  margin-top: 4px;
}

.list-wrap::-webkit-scrollbar {
  width: 6px;
}

.list-wrap::-webkit-scrollbar-track {
  background: transparent;
}

.list-wrap::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.list-wrap::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 8px 0 12px;
  background: var(--urlbar-input-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--urlbar-input-border);
  flex-shrink: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-wrap:focus-within {
  border-color: var(--urlbar-input-border-focus);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15);
}

.suggest-input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  min-width: 0;
}

.suggest-input::placeholder {
  color: var(--color-text-tertiary);
}

.security-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.1s ease;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background: var(--tabbar-hover-bg);
}

.favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
}

.favicon-placeholder {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.url {
  font-size: 11px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge {
  color: var(--color-accent);
  font-size: 12px;
  flex-shrink: 0;
}
</style>
