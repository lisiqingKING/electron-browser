<script setup lang="ts">
import { computed } from 'vue'
import { getInternalIconFromUrl } from '../../../utils/tabIcons'

const props = defineProps<{
  favorites: { title?: string; url: string; favicon?: string | null }[]
  windowId?: number
}>()

function hide() {
  window.ipcRenderer.send('popup:hide')
}

function openUrl(url: string) {
  window.ipcRenderer.invoke('tabs:create', { title: '加载中...', url }, undefined, props.windowId)
  hide()
}

const favoritesWithIcons = computed(() =>
  props.favorites.map(item => ({
    ...item,
    icon: getInternalIconFromUrl(item.url),
  }))
)
</script>

<template>
  <div class="menu">
    <div
      v-for="item in favoritesWithIcons"
      :key="item.url"
      class="item"
      @click="openUrl(item.url)"
    >
      <span class="icon">
        <svg v-if="item.icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path :d="item.icon" />
        </svg>
        <img v-else-if="item.favicon" :src="item.favicon" width="16" height="16" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </span>
      <span class="label">{{ item.title || item.url }}</span>
    </div>
  </div>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  width: 200px;
  padding: 4px;
}
.item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.1s ease;
}
.item:hover {
  background: var(--tabbar-hover-bg);
}
.icon {
  width: 22px;
  height: 22px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon svg {
  color: var(--color-accent);
}
.icon img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.label {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
