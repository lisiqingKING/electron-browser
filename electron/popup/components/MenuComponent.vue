<script setup lang="ts">
import { computed } from 'vue'
interface MenuItem {
  label?: string
  action?: string
  icon?: string
  type?: string
  disabled?: boolean
  children?: MenuItem[]
}

const props = defineProps<{
  data: { items: MenuItem[] }
  context?: any
}>()

const items = computed(() => props.data?.items || [])

const emit = defineEmits<{
  (e: 'action', action: string, context?: any): void
}>()

const ICON_PATHS: Record<string, string> = {
  history: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
}

function getIconPath(icon?: string): string | null {
  return icon ? (ICON_PATHS[icon] || null) : null
}
</script>

<template>
  <div class="menu">
    <template v-for="(item, i) in items" :key="i">
      <div v-if="item.type === 'separator'" class="sep" />
      <div
        v-else
        class="item"
        :class="{ disabled: item.disabled }"
        @click="() => { if (!item.disabled && item.action) emit('action', item.action, context) }"
      >
        <span v-if="item.icon" class="icon">
          <svg v-if="getIconPath(item.icon)" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path :d="getIconPath(item.icon)" />
          </svg>
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
}
.label {
  flex: 1;
  font-size: 13px;
}
</style>
