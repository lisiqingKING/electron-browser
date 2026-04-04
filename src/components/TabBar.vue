<script setup lang="ts">
defineProps<{
  tabs: { title: string; url: string }[]
}>()

const emit = defineEmits<{
  (e: 'add'): void
}>()
</script>

<template>
  <div class="tab-bar">
    <div class="tabs">
      <div v-for="(tab, index) in tabs" :key="index" class="tab">
        <span class="tab-title">{{ tab.title }}</span>
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

.tab-title {
  color: #e4e7eb;
  font-size: 14px;
  white-space: nowrap;
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
