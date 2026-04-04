<script setup lang="ts">
defineProps<{
  tabs: { title: string; url: string; id?: string }[]
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
        <span class="tab-title">{{ tab.title }}</span>
        <button v-if="index !== 0" class="close-btn" @click.stop="emit('close', tab.id!)">×</button>
      </div>
    </div>
    <button class="add-btn" @click="emit('add')">+</button>
  </div>
</template>

<style scoped>
.tab-bar {
  height: 40px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  flex-shrink: 0;
  background: #16213e;
  gap: 16px;
  padding: 5px;
}

.tabs {
  display: flex;
  gap: 8px;
  flex: 1;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.15);
}

.tab.active {
  background: #6366f1;
}

.tab-title {
  color: #e4e7eb;
  font-size: 14px;
  white-space: nowrap;
}

.close-btn {
  margin-left: 8px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #e4e7eb;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.close-btn:hover {
  background: rgba(255, 100, 100, 0.6);
}

.add-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #6366f1;
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.add-btn:hover {
  background: #5558e3;
}
</style>