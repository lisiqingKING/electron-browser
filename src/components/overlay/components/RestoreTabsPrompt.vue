<script setup lang="ts">
const props = defineProps<{
  tabCount?: number
  windowId?: number
}>()

const tabsMod = window.bridge.getModules(['tabs']).tabs
const popupMod = window.bridge.getModules(['popup']).popup

function hide() {
  popupMod.hide()
}

async function handleRestore() {
  await tabsMod.restore(props.windowId)
  hide()
}

async function handleDecline() {
  await tabsMod.clearSaved()
  hide()
}
</script>

<template>
  <div class="prompt">
    <div class="title">检测到上次退出前的标签页</div>
    <div class="desc">是否恢复 {{ tabCount ?? 0 }} 个标签页？</div>
    <div class="actions">
      <div class="btn btn-secondary" @click="handleDecline">取消</div>
      <div class="btn btn-primary" @click="handleRestore">恢复</div>
    </div>
  </div>
</template>

<style scoped>
.prompt {
  /* width: 220px; */
  padding: 14px 16px;
  overflow: hidden;
  box-sizing: border-box;
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
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
  justify-content: flex-end;
}
.btn {
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s ease;
  white-space: nowrap;
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
