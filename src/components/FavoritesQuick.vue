<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { usePopup } from '../composables/usePopup'

const emit = defineEmits<{
  (e: 'select', url: string): void
}>()

const { showMenu } = usePopup()

const favorites = ref<any[]>([])
const containerWidth = ref(0)
const containerRef = ref<HTMLElement | null>(null)
const itemsRef = ref<HTMLElement[]>([])

const MORE_WIDTH = 32 // 展开按钮宽度
const PADDING = 24 // 左右padding

// 计算能显示的最大数量
const maxCount = computed(() => {
  if (!containerWidth.value || itemsRef.value.length === 0) {
    return favorites.value.length
  }

  const GAP = 8 // items 之间的 gap
  const available = containerWidth.value - PADDING - MORE_WIDTH
  if (available <= 0) return 0

  // 计算所有收藏项的总宽度（含 gap）
  let totalWidth = 0
  for (let i = 0; i < itemsRef.value.length; i++) {
    const item = itemsRef.value[i]
    if (item) {
      totalWidth += item.offsetWidth
      if (i > 0) totalWidth += GAP
    }
  }

  if (totalWidth <= available) {
    return favorites.value.length
  }

  // 二分查找能显示的最大数量
  let left = 0
  let right = favorites.value.length

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2)
    let sum = 0
    for (let i = 0; i < mid && i < itemsRef.value.length; i++) {
      if (itemsRef.value[i]) {
        sum += itemsRef.value[i].offsetWidth
        if (i > 0) sum += GAP
      }
    }
    if (sum + MORE_WIDTH <= containerWidth.value - PADDING) {
      left = mid
    } else {
      right = mid - 1
    }
  }

  return left
})

const visibleItems = computed(() => {
  return favorites.value.slice(0, maxCount.value)
})

const hasMore = computed(() => favorites.value.length > maxCount.value)

const loadFavorites = async () => {
  try {
    favorites.value = await window.ipcRenderer.invoke('favorites:list')
  } catch {
    favorites.value = []
  }
}

const handleSelect = (url: string) => {
  emit('select', url)
}

const handleMoreClick = (event: MouseEvent) => {
  const remaining = favorites.value.slice(maxCount.value)
  if (remaining.length === 0) return

  const menuItems = remaining.map((item: any) => ({
    label: item.title || item.url,
    action: 'openUrl',
    context: { url: item.url },
    favicon: item.favicon || null,
  }))

  showMenu(event, menuItems)
}

const updateWidth = () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.offsetWidth
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  loadFavorites()

  resizeObserver = new ResizeObserver(() => {
    updateWidth()
  })

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
    updateWidth()
  }

  window.ipcRenderer.on('favorites:changed', (_event: any, data: any[]) => {
    if (data && Array.isArray(data)) {
      favorites.value = data
    }
  })
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  window.ipcRenderer.removeAllListeners('favorites:changed')
})
</script>

<template>
  <div ref="containerRef" class="favorites-quick">
    <div v-if="favorites.length === 0" class="favorites-empty">暂无收藏</div>
    <template v-else>
      <div
        v-for="(item, index) in visibleItems"
        :key="item.url"
        :ref="el => { if (el) itemsRef[index] = el as HTMLElement }"
        class="favorite-item"
        :title="item.title || item.url"
        @click="handleSelect(item.url)"
      >
        <img
          v-if="item.favicon"
          :src="item.favicon"
          class="favorite-icon"
          @error="($event.target as HTMLImageElement).style.display='none'"
        />
        <svg v-else class="favorite-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
        <span class="favorite-title">{{ item.title || item.url }}</span>
      </div>
      <div v-if="hasMore" class="favorite-more" title="更多收藏" @click="handleMoreClick">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
        </svg>
      </div>
    </template>
  </div>
</template>

<style scoped>
.favorites-quick {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  width: 100%;
  box-sizing: border-box;
  background: var(--urlbar-bg);
  overflow: hidden;
}

.favorite-item {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s ease;
  flex-shrink: 0;
}

.favorite-item:hover {
  background: var(--window-btn-hover);
}

.favorite-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
}

.favorite-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.favorite-more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 4px;
  cursor: pointer;
  color: var(--urlbar-icon);
  transition: background 0.1s ease;
}

.favorite-more:hover {
  background: var(--window-btn-hover);
}

.favorites-empty {
  font-size: 12px;
  color: var(--color-text-tertiary);
  padding: 0 8px;
}
</style>
