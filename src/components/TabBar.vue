<script setup lang="ts">
defineProps<{
  tabs: { title: string; url: string; id?: string; isLoading?: boolean }[]
  currentTabId: string | null
}>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'switch', tabId: string): void
  (e: 'close', tabId: string): void
}>()
</script>

<template>
  <div class="tab-bar">
    <div class="tabs">
      <div
        v-for="(tab, index) in tabs"
        :key="index"
        class="tab"
        :class="{ active: tab.id === currentTabId }"
        @click="emit('switch', tab.id!)"
      >
        <div class="tab-favicon">
          <svg v-if="tab.isLoading" class="loading-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm8 16a8 8 0 0 1-8 8v-2a10 10 0 0 0 10-10h-2a8 8 0 0 1-8 8v2a8 8 0 0 1-8-8v-2a10 10 0 0 1 10-10h2a8 8 0 0 1 8 8z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>
        <span class="tab-title">{{ tab.title }}</span>
        <button v-if="index !== 0" class="close-btn" @click.stop="emit('close', tab.id!)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <button class="add-btn" @click="emit('add')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  height: 40px;
  display: flex;
  align-items: flex-end;
  box-sizing: border-box;
  flex-shrink: 0;
  background: #1a1a1a;
  /* padding: 0 4px; */
}

.tabs {
  display: flex;
  gap: 0;
  flex: 1;
  overflow-x: auto;
  height: 100%;
  align-items: flex-end;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 40px;
  background: #2d2d2d;
  cursor: pointer;
  flex-shrink: 0;
  gap: 8px;
  position: relative;
  min-width: 120px;
  max-width: 200px;
  transition: background 0.15s ease;
  border-left: 1px solid #444;
}

.tab:first-child {
  border-left: none;
}

.tab::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
  transition: background 0.15s ease;
}

.tab:hover {
  background: #3d3d3d;
}

.tab:hover .close-btn {
  opacity: 1;
}

.tab.active {
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1b2e 50%, #16213e 100%);
}

.tab.active::before {
  background: #1a73e8;
}

.tab-favicon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8ab4f8;
  flex-shrink: 0;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tab-title {
  color: #e8eaed;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  text-align: left;
}

.tab:not(.active) .tab-title {
  color: #9aa0a6;
}

.close-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #9aa0a6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8eaed;
}

.tab.active .close-btn {
  opacity: 1;
}

.add-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #9aa0a6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 4px;
  align-self: flex-end;
  transition: background 0.15s ease, color 0.15s ease;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8eaed;
}
</style>
