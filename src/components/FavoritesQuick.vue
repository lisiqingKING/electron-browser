<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { cloneDeep } from 'lodash'
import { usePopup } from '../composables/usePopup'
import { getInternalIconFromUrl } from '../utils/tabIcons'

const emit = defineEmits<{
  (e: 'select', url: string): void
}>()

const { show } = usePopup()

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

const visibleItemsWithIcons = computed(() =>
  visibleItems.value.map(item => ({
    ...item,
    icon: getInternalIconFromUrl(item.url),
  }))
)

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
  const remaining = cloneDeep(favorites.value.slice(maxCount.value))
  if (remaining.length === 0) return

  const POPUP_WIDTH = 200
  const ICON_HEIGHT = 20
  // 右对齐，图标下方显示
  const x = event.screenX - POPUP_WIDTH
  const y = event.screenY  + ICON_HEIGHT

  show({
    x,
    y,
    component: 'FavoritesMoreMenu',
    props: { favorites: remaining },
  })
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
    <div v-if="favorites.length === 0" class="favorites-empty">还没有收藏，点击工具栏 ★ 添加</div>
    <template v-else>
      <div
        v-for="(item, index) in visibleItemsWithIcons"
        :key="item.url"
        :ref="el => { if (el) itemsRef[index] = el as HTMLElement }"
        class="favorite-item"
        :title="item.title || item.url"
        @click="handleSelect(item.url)"
      >
        <svg v-if="item.icon" class="favorite-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path :d="item.icon" />
        </svg>
        <img
          v-else-if="item.favicon"
          :src="item.favicon"
          class="favorite-icon"
          @error="($event.target as HTMLImageElement).style.display='none'"
        />
        <svg v-else class="favorite-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
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

<style lang="scss" scoped>
.favorites-quick {
  @include flex-y-center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  width: 100%;
  box-sizing: border-box;
  background: var(--urlbar-bg);
  overflow: hidden;
}

.favorite-item {
  @include flex-y-center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  @include transition(background transform box-shadow);
  flex-shrink: 0;

  &:hover {
    background: var(--window-btn-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
}

.favorite-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
  color: var(--color-accent);
}

.favorite-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  @include text-ellipsis;
  max-width: 120px;
}

.favorite-more {
  @include flex-center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--urlbar-icon);
  @include transition(background color);

  &:hover {
    background: var(--window-btn-hover);
    color: var(--urlbar-icon-hover);
  }
}

.favorites-empty {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 0 8px;
}
</style>
