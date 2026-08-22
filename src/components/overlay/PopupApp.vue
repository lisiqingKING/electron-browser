<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TabContextMenu from './components/TabContextMenu.vue'
import UrlBarMoreMenu from './components/UrlBarMoreMenu.vue'
import FavoritesMoreMenu from './components/FavoritesMoreMenu.vue'
import RestoreTabsPrompt from './components/RestoreTabsPrompt.vue'
import '../../styles/tokens/primitive.css'
import '../../styles/tokens/light.css'
import '../../styles/tokens/dark.css'

const component = ref('Menu')
const props = ref<Record<string, any>>({})
const context = ref<any>(null)

const componentMap: Record<string, any> = {
  TabContextMenu,
  UrlBarMoreMenu,
  FavoritesMoreMenu,
  RestoreTabsPrompt,
}
const currentComponent = computed(() => componentMap[component.value] || TabContextMenu)

const popupStyle = ref<Record<string, string>>({})

function handleAction(action: string, ctx?: any) {
  const safeContext = ctx ? JSON.parse(JSON.stringify(ctx)) : undefined
  window.ipcRenderer.send('popup:action', { action, context: safeContext, windowId: props.value.windowId })
}

// Register IPC listener immediately (before onMounted) to catch popup:render
window.ipcRenderer.on('popup:render', (_event: any, payload: any) => {
  if (payload.theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  component.value = payload.component || 'Menu'
  props.value = { ...payload.props, windowId: payload.windowId }
  context.value = payload.context

  popupStyle.value = {
    position: 'absolute',
    borderRadius: '8px',
    padding: '2px',
    left: payload.x + 'px',
    top: payload.y + 'px',
    width: 'fit-content',
  }
})

window.ipcRenderer.on('popup:hide', () => {
  popupStyle.value = { display: 'none' }
})

function onDocumentClick(e: MouseEvent) {
  const popup = document.getElementById('popup')
  if (popup && !popup.contains(e.target as Node)) {
    window.ipcRenderer.send('popup:hide')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
  window.addEventListener('blur', () => window.ipcRenderer.send('popup:hide'))
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentClick)
})
</script>

<template>
  <div id="popup" class="popup" :style="popupStyle">
    <component :is="currentComponent" v-bind="props" :context="context" @action="handleAction" />
  </div>
</template>

<style>
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
