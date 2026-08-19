<script setup lang="ts">
import { ref } from 'vue'
import { TAB_ICON_MAP } from '@renderer/utils/tabIcons'

const props = defineProps<{
  currentUrl?: string
  windowId?: number
}>()

const activeSubmenu = ref<number | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const favorites = ref<any[]>([])
const favoritesLoaded = ref(false)

async function loadFavorites() {
  if (favoritesLoaded.value) return
  try {
    const list = await window.ipcRenderer.invoke('favorites:list')
    favorites.value = list || []
  } catch {
    favorites.value = []
  }
  favoritesLoaded.value = true
}

function hide() {
  window.ipcRenderer.send('popup:hide')
}

function showSubmenu(index: number) {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  activeSubmenu.value = index
  if (index === 0) {
    loadFavorites()
  }
}

function hideSubmenu() {
  hideTimer = setTimeout(() => {
    activeSubmenu.value = null
  }, 100)
}

function getIconPath(icon?: string): string | null {
  return icon ? (TAB_ICON_MAP[icon] || null) : null
}

function isUnicodeChar(icon?: string): boolean {
  return !!icon && !getIconPath(icon)
}

const menuItems = [
  { label: '收藏夹', icon: 'star', hasSubmenu: true },
  { label: '历史记录', icon: 'history', action: 'openHistory' },
  { label: '下载记录', icon: 'downloads', action: 'openDownloads' },
  { label: '日志管理', icon: 'logs', action: 'openLogs' },
  { label: '设置', icon: 'settings', action: 'openSettings' },
]

function handleClick(action: string) {
  switch (action) {
    case 'openHistory':
      window.ipcRenderer.invoke('tabs:createHistory', undefined, props.windowId)
      break
    case 'openDownloads':
      window.ipcRenderer.invoke('tabs:createDownloads', undefined, props.windowId)
      break
    case 'openLogs':
      window.ipcRenderer.invoke('tabs:createLogs', undefined, props.windowId)
      break
    case 'openSettings':
      window.ipcRenderer.invoke('tabs:createSettings', undefined, props.windowId)
      break
  }
  hide()
}

function openFavorite(url: string) {
  window.ipcRenderer.invoke('tabs:create', { title: '加载中...', url }, undefined, props.windowId)
  hide()
}

function openFavorites() {
  window.ipcRenderer.invoke('tabs:createFavorites', undefined, props.windowId)
  hide()
}
</script>

<template>
  <div class="menu">
    <div
      v-for="(item, i) in menuItems"
      :key="i"
      class="item"
      :class="{ 'has-submenu': item.hasSubmenu }"
      @click="() => { if (!item.hasSubmenu && item.action) handleClick(item.action) }"
      @mouseenter="() => { if (item.hasSubmenu) showSubmenu(i) }"
      @mouseleave="hideSubmenu"
    >
      <span class="icon">
        <svg v-if="getIconPath(item.icon)" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path :d="getIconPath(item.icon) ?? undefined" />
        </svg>
        <span v-else-if="isUnicodeChar(item.icon)" class="unicode-icon">{{ item.icon }}</span>
      </span>
      <span class="label">{{ item.label }}</span>
      <span v-if="item.hasSubmenu" class="arrow">▶</span>

      <!-- Submenu: Favorites -->
      <div v-if="item.hasSubmenu && activeSubmenu === i" class="submenu">
        <template v-if="favorites.length > 0">
          <div
            v-for="fav in favorites.slice(0, 8)"
            :key="fav.url"
            class="item"
            @click.stop="openFavorite(fav.url)"
          >
            <span v-if="fav.favicon" class="icon favicon-icon">
              <img :src="fav.favicon" width="16" height="16" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
            </span>
            <span v-else class="icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </span>
            <span class="label">{{ fav.title || fav.url }}</span>
          </div>
          <div class="sep" />
        </template>
        <div class="item" @click.stop="openFavorites">
          <span class="icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z"/>
            </svg>
          </span>
          <span class="label">管理收藏夹...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  width: 180px;
  padding: 4px;
  position: relative;
}
.sep {
  height: 1px;
  margin: 4px 8px;
  background: var(--color-divider);
}
.item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.1s ease;
  position: relative;
}
.item:hover {
  background: var(--tabbar-hover-bg);
}
.has-submenu {
  user-select: none;
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
.unicode-icon {
  font-size: 14px;
  color: var(--color-text-secondary);
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
.arrow {
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.submenu {
  position: absolute;
  right: 100%;
  top: -4px;
  min-width: 200px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  margin-right: 4px;
  display: flex;
  flex-direction: column;
}
.submenu .item {
  width: 100%;
}
</style>
