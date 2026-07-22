<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'

const props = defineProps<{
  tabs: { title: string; url: string; id?: string; wcId?: number; isLoading?: boolean }[]
  currentTabId: string | null
}>()

const hoveredTabId = ref<string | null>(null)
const hoveredMemory = ref<{ usedJSHeapSize: number; totalJSHeapSize: number } | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
const formatMB = (mb: number) => `${mb.toFixed(1)} MB`

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

const emit = defineEmits<{
  (e: 'switch', tabId: string): void
  (e: 'close', tabId: string): void
}>()

const tabsContainer = ref<HTMLDivElement | null>(null)

// 第一个tab固定，其余可滚动
const firstTab = computed(() => props.tabs[0])
const scrollableTabs = computed(() => props.tabs.slice(1))

// 切换 tab 时确保可见
watch(() => props.currentTabId, () => {
  nextTick(() => {
    if (!tabsContainer.value || !props.currentTabId) return
    const activeTab = tabsContainer.value.querySelector('.tab.active') as HTMLElement
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  })
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    if (!tabsContainer.value || !props.currentTabId) return
    const activeTab = tabsContainer.value.querySelector('.tab.active') as HTMLElement
    if (activeTab) {
      activeTab.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
  })

  if (tabsContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (!tabsContainer.value || !props.currentTabId) return
      const activeTab = tabsContainer.value.querySelector('.tab.active') as HTMLElement
      if (activeTab) {
        activeTab.scrollIntoView({ block: 'nearest', inline: 'center' })
      }
    })
    resizeObserver.observe(tabsContainer.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="tab-bar">
    <!-- 固定第一个 tab -->
    <div
      v-if="firstTab"
      class="tab pinned-first"
      :class="{ active: firstTab.id === currentTabId }"
      @click="emit('switch', firstTab.id!)"
      @mouseenter="onTabEnter($event, firstTab)"
      @mouseleave="onTabLeave"
    >
      <div class="tab-favicon">
        <svg v-if="firstTab.isLoading" class="loading-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm8 16a8 8 0 0 1-8 8v-2a10 10 0 0 0 10-10h-2a8 8 0 0 1-8 8v2a8 8 0 0 1-8-8v-2a10 10 0 0 1 10-10h2a8 8 0 0 1 8 8z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
      <span class="tab-title">{{ firstTab.title }}</span>
    </div>

    <Transition name="fade">
      <div v-if="hoveredTabId && hoveredMemory" class="memory-tooltip" :style="tooltipStyle">
        <span>内存 {{ formatMB(hoveredMemory.totalJSHeapSize) }}</span>
      </div>
    </Transition>

    <!-- 可滚动区域 -->
    <div class="tabs-scroll-container" ref="tabsContainer">
      <div class="tabs-scroll">
        <div
          v-for="tab in scrollableTabs"
          :key="tab.id"
          class="tab scrollable-tab"
          :class="{ active: tab.id === currentTabId }"
          @click="emit('switch', tab.id!)"
          @mouseenter="onTabEnter($event, tab)"
          @mouseleave="onTabLeave"
        >
          <div class="tab-favicon">
            <svg v-if="tab.isLoading" class="loading-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm8 16a8 8 0 0 1-8 8v-2a10 10 0 0 0 10-10h-2a8 8 0 0 1-8 8v2a8 8 0 0 1-8-8v-2a10 10 0 0 1 10-10h2a8 8 0 0 1 8 8z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <span class="tab-title">{{ tab.title }}</span>
          <button class="close-btn" @click.stop="emit('close', tab.id!)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  height: 40px;
  display: flex;
  align-items: flex-end;
  box-sizing: border-box;
  flex-shrink: 0;
  background: #1a1a1a;
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 40px;
  background: #2d2d2d;
  cursor: pointer;
  flex-shrink: 0;
  gap: 8px;
  position: relative;
  min-width: 120px;
  max-width: 200px;
  transition: background 0.15s ease;
  border-left: 1px solid #444;
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
  background: #3d3d3d;
}

.tab:hover .close-btn {
  opacity: 1;
}

.tab.active {
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1b2e 50%, #16213e 100%);
}

.tab.active::before {
  background: #1a73e8;
}

.tab-favicon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8ab4f8;
  flex-shrink: 0;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tab-title {
  color: #e8eaed;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  text-align: left;
}

.tab:not(.active) .tab-title {
  color: #9aa0a6;
}

.close-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #9aa0a6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8eaed;
}

.tab.active .close-btn {
  opacity: 1;
}

/* 固定第一个 tab */
.pinned-first {
  border-left: none;
  border-right: 1px solid #444;
}

/* 滚动容器 */
.tabs-scroll-container {
  flex: 1;
  overflow: hidden;
  height: 100%;
  display: flex;
  align-items: flex-end;
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

.scrollable-tab {
  border-left: 1px solid #444;
}

/* 添加按钮 */
.add-btn {
  flex-shrink: 0;
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
  align-self: center;
  transition: background 0.15s ease, color 0.15s ease;
  margin-left: 4px;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8eaed;
}

.memory-tooltip {
  position: fixed;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: #9aa0a6;
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