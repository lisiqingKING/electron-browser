<script setup lang="ts">
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
</script>

<template>
  <div class="menu">
    <div
      v-for="item in favorites"
      :key="item.url"
      class="item"
      @click="openUrl(item.url)"
    >
      <span v-if="item.favicon" class="icon favicon-icon">
        <img :src="item.favicon" width="16" height="16" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
      </span>
      <span v-else class="icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
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
  color: var(--color-accent);
}
.favicon-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.favicon-icon img {
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
