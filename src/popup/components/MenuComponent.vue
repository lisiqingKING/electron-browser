<script setup lang="ts">
import { computed, ref } from 'vue'
import { TAB_ICON_MAP } from '@renderer/utils/tabIcons'

interface MenuItem {
  label?: string
  action?: string
  icon?: string
  favicon?: string
  type?: string
  disabled?: boolean
  children?: MenuItem[]
  context?: any
}

const props = defineProps<{
  data: { items: MenuItem[] }
  context?: any
}>()

const items = computed(() => props.data?.items || [])

const emit = defineEmits<{
  (e: 'action', action: string, context?: any): void
}>()

const activeSubmenu = ref<number | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function getIconPath(icon?: string): string | null {
  return icon ? (TAB_ICON_MAP[icon] || null) : null
}

function isUnicodeChar(icon?: string): boolean {
  return !!icon && !getIconPath(icon)
}

function showSubmenu(index: number) {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  activeSubmenu.value = index
}

function hideSubmenu() {
  // 延迟隐藏，避免鼠标快速移入子菜单时被隐藏
  hideTimer = setTimeout(() => {
    activeSubmenu.value = null
  }, 100)
}

function hasSubmenu(item: MenuItem): boolean {
  return !!(item.children && item.children.length > 0)
}
</script>

<template>
  <div class="menu">
    <template v-for="(item, i) in items" :key="i">
      <div v-if="item.type === 'separator'" class="sep" />
      <div
        v-else
        class="item"
        :class="{ disabled: item.disabled, 'has-submenu': hasSubmenu(item) }"
        @click="() => { if (!item.disabled && item.action) emit('action', item.action, context) }"
        @mouseenter="() => { if (hasSubmenu(item)) showSubmenu(i) }"
        @mouseleave="hideSubmenu"
      >
        <span v-if="item.icon" class="icon">
          <svg v-if="getIconPath(item.icon)" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path :d="getIconPath(item.icon) ?? undefined" />
          </svg>
          <span v-else-if="isUnicodeChar(item.icon)" class="unicode-icon">{{ item.icon }}</span>
        </span>
        <span class="label">{{ item.label }}</span>
        <!-- Submenu -->
        <div v-if="hasSubmenu(item) && activeSubmenu === i" class="submenu">
          <template v-for="(child, ci) in item.children" :key="ci">
            <div v-if="child.type === 'separator'" class="sep" />
            <div
              v-else
              class="item"
              :class="{ disabled: child.disabled }"
              @click.stop="() => { if (!child.disabled && child.action) emit('action', child.action, child.context) }"
            >
              <span v-if="child.favicon" class="icon favicon-icon">
                <img :src="child.favicon" width="16" height="16" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
              </span>
              <span v-else-if="child.icon" class="icon">
                <svg v-if="getIconPath(child.icon)" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path :d="getIconPath(child.icon) ?? undefined" />
                </svg>
                <span v-else-if="isUnicodeChar(child.icon)" class="unicode-icon">{{ child.icon }}</span>
              </span>
              <span class="label">{{ child.label }}</span>
            </div>
          </template>
        </div>
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
  position: relative;
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
  position: relative;
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
.favicon-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.favicon-icon img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.label {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.submenu-arrow {
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin-left: 4px;
}
.submenu {
  position: absolute;
  right: 100%;
  top: -4px;
  min-width: 200px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  margin-right: 8px;
  display: flex;
  flex-direction: column;
}
.submenu .item {
  width: 100%;
}
</style>
