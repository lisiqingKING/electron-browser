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
        <span v-if="item.icon" class="icon">{{ item.icon }}</span>
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
}
.sep {
  height: 1px;
  margin: 3px 8px;
  background: var(--color-divider);
}
.item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
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
  width: 20px;
  margin-right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}
.label {
  flex: 1;
}
</style>
