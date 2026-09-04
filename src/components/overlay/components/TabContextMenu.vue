<script setup lang="ts">
import { computed } from 'vue'
import { TAB_ICON_MAP, getRouteFromUrl } from '@renderer/utils/tabIcons'
import { isNewTabUrl } from '@renderer/utils'

const props = defineProps<{
  tabId: string
  tabs: { title: string; url: string; id?: string; isHome?: boolean }[]
  windowId?: number
}>()

const tabsMod = window.bridge.getModules(['tabs']).tabs
const windowMod = window.bridge.getModules(['window']).window
const popupMod = window.bridge.getModules(['popup']).popup

function hide() {
  popupMod.hide()
}

const tab = () => props.tabs.find(t => t.id === props.tabId)
const isHome = () => tab()?.isHome ?? false

const isInternal = computed(() => {
  const t = tab()
  return t ? getRouteFromUrl(t.url) !== null : false
})

const isNewTab = computed(() => {
  const t = tab()
  return t ? isNewTabUrl(t.url) : false
})

const openInNewTabDisabled = computed(() => {
  return isHome() || (isInternal.value && !isNewTab.value)
})

const menuItems = computed(() => [
  { label: '刷新', action: 'reload', icon: '↻' },
  { label: '在新标签页中打开', action: 'openInNewTab', icon: '+', disabled: openInNewTabDisabled.value },
  { label: '在新窗口中打开', action: 'openInNewWindow', icon: '⧉', disabled: isHome() },
  { type: 'separator' },
  { label: '关闭', action: 'close', icon: '×', disabled: isHome() },
  { label: '关闭左侧标签页', action: 'closeLeft', icon: '←', disabled: isHome() },
  { label: '关闭其他标签页', action: 'closeOthers', icon: '⊗', disabled: isHome() },
  { label: '关闭右侧标签页', action: 'closeRight', icon: '→', disabled: isHome() },
])

function getIconPath(icon?: string): string | null {
  return icon ? (TAB_ICON_MAP[icon] || null) : null
}

function isUnicodeChar(icon?: string): boolean {
  return !!icon && !getIconPath(icon)
}

function handleClick(action: string) {
  const currentTab = tab()
  if (!currentTab) return

  switch (action) {
    case 'reload':
      tabsMod.reload(props.tabId, props.windowId)
      break
    case 'openInNewTab':
      tabsMod.create({ title: currentTab.title, url: currentTab.url }, props.tabId, props.windowId)
      break
    case 'openInNewWindow':
      windowMod.adoptTab(props.tabId)
      break
    case 'close':
      tabsMod.close(props.tabId, props.windowId)
      break
    case 'closeLeft':
      tabsMod.closeLeft(props.tabId, props.windowId)
      break
    case 'closeRight':
      tabsMod.closeRight(props.tabId, props.windowId)
      break
    case 'closeOthers':
      tabsMod.closeOthers(props.tabId, props.windowId)
      break
  }
  hide()
}
</script>

<template>
  <div class="menu">
    <template v-for="(item, i) in menuItems" :key="i">
      <div v-if="item.type === 'separator'" class="sep" />
      <div
        v-else
        class="item"
        :class="{ disabled: item.disabled }"
        @click="() => { if (!item.disabled) handleClick(item.action!) }"
      >
        <span class="icon">
          <svg v-if="getIconPath(item.icon)" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path :d="getIconPath(item.icon) ?? undefined" />
          </svg>
          <span v-else-if="isUnicodeChar(item.icon)" class="unicode-icon">{{ item.icon }}</span>
        </span>
        <span class="label">{{ item.label }}</span>
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
}
.item:hover {
  background: var(--tabbar-hover-bg);
}
.item.disabled {
  cursor: not-allowed;
  color: var(--color-text-tertiary);
}
.item.disabled:hover {
  background: transparent;
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
</style>
