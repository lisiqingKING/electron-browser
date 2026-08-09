<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import WindowControls from './WindowControls.vue'
import { usePopup } from '../composables/usePopup'
import { useTabDrag } from '../composables/useTabDrag'
import { getInternalIconFromUrl, getRouteFromUrl } from '../utils/tabIcons'
import { isNewTabUrl } from '../utils'

const props = defineProps<{
  tabs: { title: string; url: string; id?: string; wcId?: number; isLoading?: boolean; favicon?: string; loadError?: { url: string; code: number; message: string }; isHome?: boolean }[]
  currentTabId: string | null
}>()

const hoveredTabId = ref<string | null>(null)
const hoveredMemory = ref<{ usedJSHeapSize: number; totalJSHeapSize: number } | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
const formatMB = (mb: number) => `${mb.toFixed(1)} MB`
const failedFavicons = ref<Set<string>>(new Set())

const onFaviconError = (url: string) => {
  failedFavicons.value.add(url)
}

const onFaviconLoad = (url: string) => {
  failedFavicons.value.delete(url)
}

const onTabEnter = async (e: MouseEvent, tab: { id?: string; wcId?: number }) => {
  hoveredTabId.value = tab.id || null
  hoveredMemory.value = null
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipStyle.value = {
    position: 'fixed',
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.bottom + 4}px`,
    transform: 'translateX(-50%)',
  }
  if (tab.wcId != null) {
    try {
      const info = await (window as any).ipcRenderer.invoke('memory:requestUpdate', tab.wcId)
      if (info) {
        hoveredMemory.value = { usedJSHeapSize: info.usedJSHeapSize, totalJSHeapSize: info.totalJSHeapSize }
      }
    } catch {}
  }
}

const onTabLeave = () => {
  hoveredTabId.value = null
  hoveredMemory.value = null
}

// 拖拽出窗口
const { onMouseDown: onTabMouseDown } = useTabDrag((tabId, screenPos) => {
  window.ipcRenderer.invoke('tab:drag-out-to-window', tabId, screenPos)
})

const emit = defineEmits<{
  (e: 'switch', tabId: string): void
  (e: 'close', tabId: string): void
  (e: 'add'): void
}>()

const tabsContainer = ref<HTMLDivElement | null>(null)

// 右键菜单
const { showMenu, hide: hidePopup, onAction } = usePopup()

const tabMenuItems = [
  { label: '刷新', action: 'reload', icon: '↻' },
  { label: '在新标签页中打开', action: 'openInNewTab', icon: '+' },
  { label: '在新窗口中打开', action: 'openInNewWindow', icon: '⧉' },
  { type: 'separator', action: 'sep1' },
  { label: '关闭', action: 'close', icon: '×' },
  { label: '关闭左侧标签页', action: 'closeLeft', icon: '←' },
  { label: '关闭其他标签页', action: 'closeOthers', icon: '⊗' },
  { label: '关闭右侧标签页', action: 'closeRight', icon: '→' },
]

const handleContextMenu = (event: MouseEvent, tabId: string) => {
  const tab = props.tabs.find(t => t.id === tabId)
  const isHome = tab?.isHome
  const isInternal = tab ? getRouteFromUrl(tab.url) !== null : false
  const isNewTab = tab ? isNewTabUrl(tab.url) : false

  const closeActions = ['close', 'closeLeft']
  const items = tabMenuItems.map(item => {
    if (item.action === 'openInNewTab') {
      // 内部页面（除新标签页）禁用"在新标签页中打开"
      return { ...item, disabled: isHome || (isInternal && !isNewTab) }
    }
    if (item.action === 'openInNewWindow') {
      return { ...item, disabled: isHome }
    }
    if (closeActions.includes(item.action)) {
      return { ...item, disabled: isHome }
    }
    return item
  })

  showMenu(event, items, { tabId })
}

const cleanupOnAction = onAction(async (action, context) => {
  const tabId = context?.tabId
  if (!tabId) return

  switch (action) {
    case 'reload':
      window.ipcRenderer.send('tabs:reload', tabId)
      break
    case 'openInNewTab': {
      const tab = props.tabs.find(t => t.id === tabId)
      if (tab) {
        window.ipcRenderer.invoke('tabs:create', { title: tab.title, url: tab.url }, tabId)
      }
      break
    }
    case 'openInNewWindow':
      window.ipcRenderer.invoke('tab:move-to-window', tabId)
      break
    case 'close':
      emit('close', tabId)
      break
    case 'closeOthers':
      window.ipcRenderer.send('tabs:closeOthers', tabId)
      break
    case 'closeLeft':
      window.ipcRenderer.send('tabs:closeLeft', tabId)
      break
    case 'closeRight':
      window.ipcRenderer.send('tabs:closeRight', tabId)
      break
  }
  hidePopup()
})

// 滚动到当前激活的 tab
const scrollToActiveTab = () => {
  if (!tabsContainer.value || !props.currentTabId) return
  const activeTab = tabsContainer.value.querySelector('.tab.active') as HTMLElement
  if (activeTab) {
    activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
}

// 切换 tab 时确保可见
watch(() => props.currentTabId, () => nextTick(scrollToActiveTab))

let resizeObserver: ResizeObserver | null = null
let resizeRaf: number | null = null

onMounted(() => {
  nextTick(scrollToActiveTab)

  if (tabsContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (resizeRaf != null) return
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null
        scrollToActiveTab()
      })
    })
    resizeObserver.observe(tabsContainer.value)
  }
})

onUnmounted(() => {
  cleanupOnAction()
  resizeObserver?.disconnect()
  if (resizeRaf != null) cancelAnimationFrame(resizeRaf)
})
</script>

<template>
  <div class="tab-bar">
    <!-- Logo -->
    <div class="tab-bar-logo">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </div>

    <Transition name="fade">
      <div v-if="hoveredTabId && hoveredMemory" class="memory-tooltip" :style="tooltipStyle">
        <span>内存 {{ formatMB(hoveredMemory.totalJSHeapSize) }}</span>
      </div>
    </Transition>

    <!-- 所有 tab 都在滚动容器内 -->
    <div class="tabs-scroll-container" ref="tabsContainer">
      <div class="tabs-scroll">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: tab.id === currentTabId }"
          @click="emit('switch', tab.id!)"
          @mousedown="onTabMouseDown($event, tab)"
          @mouseenter="onTabEnter($event, tab)"
          @mouseleave="onTabLeave"
          @contextmenu="handleContextMenu($event, tab.id!)"
        >
          <div class="tab-favicon">
            <!-- 加载中：环状动画 -->
            <svg v-if="tab.isLoading" class="loading-spinner" viewBox="0 0 24 24" width="16" height="16">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
            </svg>
            <!-- 加载失败：感叹号 -->
            <svg v-else-if="tab.loadError" class="error-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <!-- 内部页面图标（优先于 favicon） -->
            <svg v-else-if="getInternalIconFromUrl(tab.url)" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path :d="getInternalIconFromUrl(tab.url) ?? undefined" />
            </svg>
            <!-- 有 favicon 且未加载失败 -->
            <img v-else-if="tab.favicon && !failedFavicons.has(tab.favicon)" :src="tab.favicon" class="favicon-img" @error="onFaviconError(tab.favicon!)" @load="onFaviconLoad(tab.favicon!)" />
            <!-- 默认图标 -->
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <span class="tab-title">{{ tab.title }}</span>
          <button v-if="!tab.isHome" class="close-btn" @click.stop="emit('close', tab.id!)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <!-- 添加按钮 - 紧跟 tab -->
        <button class="add-btn" @click="emit('add')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 窗口控制按钮 -->
    <WindowControls />
  </div>
</template>

<style scoped>
.tab-bar {
  height: 48px;
  display: flex;
  align-items: flex-end;
  box-sizing: border-box;
  flex-shrink: 0;
  background: var(--tabbar-bg);
  -webkit-app-region: drag;
}

.tab-bar-logo {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: auto 8px auto 12px;
  color: var(--color-accent);
  -webkit-app-region: no-drag;
  cursor: pointer;
  height: 36px;
  margin-top: 12px;
}

.tab-bar-logo:hover {
  opacity: 0.8;
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 36px;
  background: transparent;
  cursor: pointer;
  flex: 1 1 0;
  gap: 6px;
  position: relative;
  min-width: 40px;
  max-width: 220px;
  transition: background 0.15s ease;
  -webkit-app-region: no-drag;
}

.tab::after {
  content: '';
  position: absolute;
  right: 0;
  top: 30%;
  bottom: 30%;
  width: 1px;
  background: var(--tabbar-divider);
}

.tab::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
  transition: background 0.15s ease;
}

.tab:hover {
  background: var(--tabbar-hover-bg);
}

.tab:hover::after,
.tab.active::after {
  opacity: 0;
}

/* hovered/active tab 左侧相邻 tab 的分割线 */
.tab:has(+ .tab:hover)::after,
.tab:has(+ .tab.active)::after {
  opacity: 0;
}

.tab:hover .close-btn {
  opacity: 1;
}

.tab.active {
  background: var(--tabbar-active-bg);
  z-index: 1;
}

.tab-favicon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  flex-shrink: 0;
}

.loading-spinner {
  animation: spin 1s linear infinite;
  color: var(--color-accent);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-icon {
  color: var(--color-status-error, #dc2626);
}

.favicon-img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.tab-title {
  color: var(--tabbar-text-active);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  flex: 1;
  min-width: 0;
}

.tab:not(.active) .tab-title {
  color: var(--tabbar-text);
}

.close-btn {
  width: 0;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--tabbar-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  overflow: hidden;
  transition: opacity 0.15s ease, background 0.15s ease, width 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.close-btn:hover {
  background: var(--tabbar-hover-bg);
  color: var(--tabbar-text-active);
}

.tab.active .close-btn,
.tab:hover .close-btn {
  opacity: 1;
  width: 20px;
}

/* 滚动容器 */
.tabs-scroll-container {
  flex: 1;
  overflow: hidden;
  height: 100%;
  min-width: 0;
  margin-right: 50px;
}

.tabs-scroll {
  display: flex;
  overflow-x: auto;
  height: 100%;
  align-items: flex-end;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs-scroll::-webkit-scrollbar {
  display: none;
}

/* 添加按钮 - 固定在右侧 */
.add-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--tabbar-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: flex-end;
  margin: 0 4px 4px 8px;
  transition: background 0.15s ease, color 0.15s ease;
  -webkit-app-region: no-drag;
}

.add-btn:hover {
  background: var(--tabbar-hover-bg);
  color: var(--tabbar-text-active);
}

.memory-tooltip {
  position: fixed;
  background: var(--tooltip-bg);
  border: 1px solid var(--tooltip-border);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--tooltip-text);
  white-space: nowrap;
  z-index: 9999;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>