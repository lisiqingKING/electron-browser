<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MenuComponent from './popup/components/MenuComponent.vue'
import '@renderer/styles/tokens/primitive.css'
import '@renderer/styles/tokens/light.css'
import '@renderer/styles/tokens/dark.css'

const type = ref('menu')
const data = ref<any>({})
const context = ref<any>(null)

const componentMap: Record<string, any> = {
  menu: MenuComponent,
}
const currentComponent = computed(() => componentMap[type.value] || MenuComponent)

const popupStyle = ref<Record<string, string>>({})

function handleAction(action: string, ctx?: any) {
  const safeContext = ctx ? JSON.parse(JSON.stringify(ctx)) : undefined
  window.ipcRenderer.send('popup:action', { action, context: safeContext })
}

onMounted(() => {
  window.ipcRenderer.on('popup:render', (_event: any, payload: any) => {
    if (payload.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    type.value = payload.type || 'menu'
    data.value = payload.data
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

  document.addEventListener('mousedown', (e: MouseEvent) => {
    const popup = document.getElementById('popup')
    if (popup && !popup.contains(e.target as Node)) {
      window.ipcRenderer.send('popup:hide')
    }
  })

  // 窗口失去焦点时隐藏菜单
  window.addEventListener('blur', () => {
    window.ipcRenderer.send('popup:hide')
  })
})
</script>

<template>
  <div id="popup" class="popup" :style="popupStyle">
    <component :is="currentComponent" :data="data" :context="context" @action="handleAction" />
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  user-select: none;
  background: transparent;
  overflow: visible;
}
.popup {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  overflow: visible;
}
</style>
