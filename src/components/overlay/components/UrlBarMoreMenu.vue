<script setup lang="ts">
import { ref, computed } from 'vue'
import { TAB_ICON_MAP, getInternalIconFromUrl } from '@renderer/utils/tabIcons'

const props = defineProps<{
  currentUrl?: string
  windowId?: number
}>()

const tabsMod = window.bridge.getModules(['tabs']).tabs
const favoritesMod = window.bridge.getModules(['favorites']).favorites
const windowMod = window.bridge.getModules(['window']).window
const popupMod = window.bridge.getModules(['popup']).popup

const activeSubmenu = ref<number | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const favorites = ref<any[]>([])
const favoritesLoaded = ref(false)

async function loadFavorites() {
  if (favoritesLoaded.value) return
  try {
    const list = await favoritesMod.list()
    favorites.value = list || []
  } catch {
    favorites.value = []
  }
  favoritesLoaded.value = true
}

function hide() {
  popupMod.hide()
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
  { label: '收藏夹', icon: 'favorites', hasSubmenu: true },
  { label: '历史记录', icon: 'history', action: 'openHistory' },
  { label: '下载记录', icon: 'downloads', action: 'openDownloads' },
  { label: '日志管理', icon: 'logs', action: 'openLogs' },
  { label: '设置', icon: 'settings', action: 'openSettings' },
  { type: 'separator' },
  { label: '打开新标签页', icon: '+', action: 'openNewTab' },
  { label: '打开新窗口', icon: '⧉', action: 'openNewWindow' },
  { label: '退出应用', icon: '×', action: 'exitApp' },
]

const menuItemsWithIcons = computed(() =>
  menuItems.map(item => ({
    ...item,
    iconPath: getIconPath(item.icon),
  }))
)

const favoritesWithIcons = computed(() =>
  favorites.value.slice(0, 8).map(fav => ({
    ...fav,
    icon: getInternalIconFromUrl(fav.url),
  }))
)

function handleClick(action: string) {
  switch (action) {
    case 'openHistory':
      tabsMod.createHistory(undefined, props.windowId)
      break
    case 'openDownloads':
      tabsMod.createDownloads(undefined, props.windowId)
      break
    case 'openLogs':
      tabsMod.createLogs(undefined, props.windowId)
      break
    case 'openSettings':
      tabsMod.createSettings(undefined, props.windowId)
      break
    case 'openNewTab':
      tabsMod.createDefault(undefined, props.windowId)
      break
    case 'openNewWindow':
      windowMod.create()
      break
    case 'exitApp':
      windowMod.quit()
      break
  }
  hide()
}

function openFavorite(url: string) {
  tabsMod.create({ title: '加载中...', url }, undefined, props.windowId)
  hide()
}

function openFavorites() {
  tabsMod.createFavorites(undefined, props.windowId)
  hide()
}
</script>

<template>
  <div class="menu">
    <template v-for="(item, i) in menuItemsWithIcons" :key="i">
      <div v-if="item.type === 'separator'" class="sep" />
      <div
        v-else
        class="item"
        :class="{ 'has-submenu': item.hasSubmenu }"
        @click="() => { if (!item.hasSubmenu && item.action) handleClick(item.action) }"
        @mouseenter="() => { if (item.hasSubmenu) showSubmenu(i) }"
        @mouseleave="hideSubmenu"
      >
        <span class="icon">
          <svg v-if="item.iconPath" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path :d="item.iconPath" />
          </svg>
          <span v-else-if="isUnicodeChar(item.icon)" class="unicode-icon">{{ item.icon }}</span>
        </span>
        <span class="label">{{ item.label }}</span>
        <span v-if="item.hasSubmenu" class="arrow">▶</span>

        <!-- Submenu: Favorites -->
        <div v-if="item.hasSubmenu && activeSubmenu === i" class="submenu">
          <template v-if="favoritesWithIcons.length > 0">
            <div
              v-for="fav in favoritesWithIcons"
              :key="fav.url"
              class="item"
              @click.stop="openFavorite(fav.url)"
            >
              <span class="icon">
                <svg v-if="fav.icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path :d="fav.icon" />
                </svg>
                <img v-else-if="fav.favicon" :src="fav.favicon" width="16" height="16" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
                <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
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
    </template>
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
