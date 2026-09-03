<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { usePopup } from '../composables/usePopup'
import { getTabIcon } from '../utils/tabIcons'
import DownloadButton from './DownloadButton.vue'

const props = defineProps<{
  modelValue: string
  canGoBack?: boolean
  canGoForward?: boolean
  isFavorited?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'goBack'): void
  (e: 'goForward'): void
  (e: 'add'): void
  (e: 'openAI'): void
  (e: 'toggleFavorite'): void
}>()

const { show, onAction } = usePopup()
const urlInputRef = ref<HTMLInputElement | null>(null)

const clipboard = window.bridge.getModules(['clipboard']).clipboard
const tabs = window.bridge.getModules(['tabs']).tabs
const suggestions = window.bridge.getModules(['suggestions']).suggestions
const windowMod = window.bridge.getModules(['window']).window

let removeActionListener: (() => void) | null = null
let isPopupShowing = false

onMounted(() => {
  removeActionListener = onAction(async (action: string, context?: any) => {
    const input = urlInputRef.value
    if (!input) return

    switch (action) {
      case 'cut': {
        const start = input.selectionStart ?? 0
        const end = input.selectionEnd ?? 0
        if (end > start) {
          const newValue = props.modelValue.slice(0, start) + props.modelValue.slice(end)
          emit('update:modelValue', newValue)
        }
        break
      }
      case 'paste': {
        const text = await clipboard.readText()
        if (!text) return
        const start = input.selectionStart ?? 0
        const end = input.selectionEnd ?? 0
        const newValue = props.modelValue.slice(0, start) + text + props.modelValue.slice(end)
        emit('update:modelValue', newValue)
        break
      }
      case 'selectAll': {
        input.select()
        break
      }
      case 'delete': {
        emit('update:modelValue', '')
        break
      }
      case 'pasteAndSearch': {
        const text = await clipboard.readText()
        if (!text) return
        emit('update:modelValue', text)
        emit('submit')
        break
      }
      case 'clearAndPaste': {
        const text = await clipboard.readText()
        if (!text) return
        emit('update:modelValue', text)
        break
      }
      case 'select': {
        if (context?.url) {
          tabs.create({ title: context.title || '加载中...', url: context.url })
        }
        isPopupShowing = false
        break
      }
      case 'search': {
        if (context?.query) {
          const url = `https://www.baidu.com/s?wd=${encodeURIComponent(context.query)}`
          tabs.create({ title: `搜索: ${context.query}`, url })
        }
        isPopupShowing = false
        break
      }
    }
  })
})

onUnmounted(() => {
  removeActionListener?.()
})

const handleRefresh = () => {
  tabs.refresh()
}

const handleContextMenu = async (event: MouseEvent) => {
  event.preventDefault()
  const input = urlInputRef.value
  if (!input) return
  const clipboardText = await clipboard.readText().catch(() => '')
  show({
    x: event.screenX,
    y: event.screenY,
    component: 'UrlBarInputContextMenu',
    props: {
      clipboardText,
      inputValue: input.value,
      selectedText: input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0),
    },
  })
}

const handleGoBack = () => {
  if (props.canGoBack) emit('goBack')
}

const handleGoForward = () => {
  if (props.canGoForward) emit('goForward')
}

const handleMoreClick = (event: MouseEvent) => {
  show({
    x: event.screenX,
    y: event.screenY,
    component: 'UrlBarMoreMenu',
    props: { currentUrl: props.modelValue },
  })
}

const handleFocus = async () => {
  if (isPopupShowing) return

  const input = urlInputRef.value
  if (!input) return

  const rect = input.getBoundingClientRect()
  const parentRect = input.parentElement?.getBoundingClientRect()
  const contentBounds = await windowMod.getContentBounds()

  try {
    const data = await suggestions.get()
    isPopupShowing = true
    input.blur()

    show({
      x: parentRect?.left + contentBounds.x,
      y: rect.top + contentBounds.y,
      component: 'UrlBarSuggestions',
      props: {
        favorites: data.favorites,
        history: data.history,
        inputValue: props.modelValue,
      },
      width: parentRect?.width ?? rect.width,
    })
  } catch (e) {
    isPopupShowing = false
    console.error('[UrlBar] suggestions.get failed:', e)
  }
}

const handleBlur = () => {
  // 输入框失焦时延迟重置，等弹窗关闭完成
  setTimeout(() => {
    isPopupShowing = false
  }, 100)
}
</script>

<template>
  <div class="url-bar">
    <div class="url-bar-inner">
      <div class="nav-buttons">
        <button class="nav-btn" :class="{ disabled: !canGoBack }" title="后退" @click="handleGoBack">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <button class="nav-btn" :class="{ disabled: !canGoForward }" title="前进" @click="handleGoForward">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
          </svg>
        </button>
        <button class="nav-btn" title="刷新" @click="handleRefresh">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>

      <div class="url-input-wrap">
        <svg class="security-icon" viewBox="0 0 24 24" width="14" height="14" fill="#9aa0a6">
          <template v-if="props.modelValue.startsWith('https')">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </template>
          <template v-else>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.48 0-8-3.58-8-8s3.52-8 8-8 8 3.58 8 8-3.52 8-8 8zm-1-4h2v2h-2zm0-2h2V7h-2z"/>
          </template>
        </svg>
        <input
          ref="urlInputRef"
          :value="props.modelValue"
          type="text"
          placeholder="搜索或输入网址"
          class="url-input"
          @focus="handleFocus"
          @blur="handleBlur"
          @contextmenu="handleContextMenu"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="emit('submit')"
        />
        <button class="star-btn" :class="{ active: props.isFavorited }" title="收藏" @click="emit('toggleFavorite')">
          <svg viewBox="0 0 24 24" width="20" height="20" :fill="props.isFavorited ? 'var(--color-accent)' : 'currentColor'">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </button>
      </div>

      <DownloadButton />
      <button class="ai-btn" title="AI 助手" @click="emit('openAI')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" :style="{ color: 'var(--color-accent)' }">
          <path :d="getTabIcon('ai') ?? undefined" />
        </svg>
      </button>
      <button class="more-btn" title="更多" @click="handleMoreClick">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" :style="{ color: 'var(--color-accent)' }">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.url-bar {
  padding: 0 12px;
  height: 48px;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--urlbar-bg);
}

.url-bar-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 100%;
}

/* ── 导航按钮 ── */
.nav-buttons {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 1px;
}

.nav-btn {
  @include circle-button(32px);
  color: var(--urlbar-icon);
  @include transition(background color);

  &:hover {
    color: var(--urlbar-icon-hover);
  }

  &:active {
    transform: scale(0.95);
  }

  &.disabled {
    color: var(--urlbar-icon-disabled);
    cursor: default;
    pointer-events: none;
  }
}

/* ── 地址输入区 ── */
.url-input-wrap {
  flex: 1;
  @include flex-y-center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  min-width: 0;
  background: var(--urlbar-input-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--urlbar-input-border);
  margin: 0 8px;
  @include transition(background border-color box-shadow);

  &:focus-within {
    border-color: var(--urlbar-input-border-focus);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  }
}

.security-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.url-input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  min-width: 0;

  &::placeholder {
    color: var(--color-text-tertiary);
  }
}

.star-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  color: var(--urlbar-icon);
  transition: color 0.2s;

  &:hover {
    color: var(--urlbar-icon-hover);
  }

  &.active {
    color: var(--color-accent);
  }
}

/* ── 图标按钮通用样式 ── */
%icon-btn {
  @include circle-button(32px);
  color: var(--urlbar-icon);
  @include transition(background color transform);

  &:hover {
    color: var(--urlbar-icon-hover);
  }

  &:active {
    transform: scale(0.95);
  }
}

/* ── 更多按钮 ── */
.more-btn {
  @extend %icon-btn;
}

/* ── AI 助手按钮 ── */
.ai-btn {
  @extend %icon-btn;
}
</style>
