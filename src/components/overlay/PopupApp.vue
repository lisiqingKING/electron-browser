<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import TabContextMenu from './components/TabContextMenu.vue'
import UrlBarMoreMenu from './components/UrlBarMoreMenu.vue'
import FavoritesMoreMenu from './components/FavoritesMoreMenu.vue'
import RestoreTabsPrompt from './components/RestoreTabsPrompt.vue'
import UrlBarInputContextMenu from './components/UrlBarInputContextMenu.vue'
import DownloadsPopup from './components/DownloadsPopup.vue'
import UrlBarSuggestions from './components/UrlBarSuggestions.vue'

const component = ref('Menu')
const props = ref<Record<string, any>>({})
const context = ref<any>(null)

const componentMap: Record<string, any> = {
  TabContextMenu,
  UrlBarMoreMenu,
  FavoritesMoreMenu,
  RestoreTabsPrompt,
  UrlBarInputContextMenu,
  DownloadsPopup,
  UrlBarSuggestions,
}
const currentComponent = computed(() => componentMap[component.value] || TabContextMenu)

const popupStyle = ref<Record<string, string>>({})

function handleAction(action: string, ctx?: any) {
  const safeContext = ctx ? JSON.parse(JSON.stringify(ctx)) : undefined
  window.bridge.send('popup:action', { action, context: safeContext, windowId: props.value.windowId })
}

const onPopupRender = (payload: any) => {
  if (payload.theme === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  }

  component.value = payload.component || 'Menu'
  props.value = { ...payload.props, windowId: payload.windowId }
  context.value = payload.context

  popupStyle.value = {
    position: 'absolute',
    borderRadius: '8px',
    padding: '0',
    left: payload.x + 'px',
    top: payload.y + 'px',
    width: (payload.width && payload.width > 0) ? payload.width + 'px' : 'fit-content',
  }
}

const onPopupHide = () => {
  popupStyle.value = { display: 'none' }
}

// Register IPC listener before onMounted to catch early events
window.bridge.on('popup:render', onPopupRender)
window.bridge.on('popup:hide', onPopupHide)

onUnmounted(() => {
  window.bridge.off('popup:render', onPopupRender)
  window.bridge.off('popup:hide', onPopupHide)
})

function onDocumentClick(e: MouseEvent) {
  const popup = document.getElementById('popup')
  if (popup && !popup.contains(e.target as Node)) {
    window.bridge.send('popup:hide')
  }
}

useEventListener(document, 'mousedown', onDocumentClick)
useEventListener(window, 'blur', () => window.bridge.send('popup:hide'))
</script>

<template>
  <div id="popup" class="popup" :style="popupStyle">
    <component :is="currentComponent" v-bind="props" :context="context" @action="handleAction" />
  </div>
</template>

<style lang="scss">
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%;
  height: 100%;
  overflow: visible;
  background: transparent;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  user-select: none;
  overflow: visible;
  background: transparent;
}
.popup {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  overflow: visible;
}
</style>
