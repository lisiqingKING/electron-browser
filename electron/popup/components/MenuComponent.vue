<script setup lang="ts">
import { computed } from 'vue'
import { TAB_ICON_MAP } from '../../../src/utils/tabIcons'

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

function getIconPath(icon?: string): string | null {
  return icon ? (TAB_ICON_MAP[icon] || null) : null
}

function isUnicodeChar(icon?: string): boolean {
  return !!icon && !getIconPath(icon)
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
}
</style>
