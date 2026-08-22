<script setup lang="ts">
const props = defineProps<{
  tabCount?: number
  windowId?: number
}>()

function hide() {
  window.ipcRenderer.send('popup:hide')
}

async function handleRestore() {
  await window.ipcRenderer.invoke('tabs:restore', props.windowId)
  hide()
}
</script>

<template>
  <div class="prompt">
    <div class="title">检测到上次退出前的标签页</div>
    <div class="desc">是否恢复 {{ tabCount ?? 0 }} 个标签页？</div>
    <div class="actions">
      <div class="btn btn-secondary" @click="hide">否</div>
      <div class="btn btn-primary" @click="handleRestore">是</div>
    </div>
  </div>
</template>

<style scoped>
.prompt {
  width: 220px;
  padding: 14px 16px;
}
.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}
.desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 14px;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.btn {
  padding: 5px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s ease;
}
.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}
.btn-secondary:hover {
  background: var(--color-bg-tertiary);
}
.btn-primary {
  background: var(--color-accent);
  color: #fff;
}
.btn-primary:hover {
  opacity: 0.85;
}
</style>
