<script setup lang="ts">
const props = defineProps<{
  clipboardText?: string
  inputValue?: string
  selectedText?: string
}>()

const emit = defineEmits<{
  (e: 'action', action: 'cut' | 'paste' | 'selectAll' | 'delete' | 'pasteAndSearch' | 'clearAndPaste'): void
}>()

const clipboard = window.bridge.getModules(['clipboard']).clipboard
const popupMod = window.bridge.getModules(['popup']).popup

function hide() {
  popupMod.hide()
}

async function doAction(action: 'copy' | 'cut' | 'paste' | 'selectAll' | 'delete' | 'pasteAndSearch' | 'clearAndPaste') {
  if (action === 'copy') {
    await clipboard.writeText(props.selectedText || props.inputValue || '')
    hide()
    return
  }
  if (action === 'cut') {
    await clipboard.writeText(props.selectedText || '')
  }
  emit('action', action)
  hide()
}

</script>

<template>
  <div class="menu">
    <div class="item" @click="doAction('copy')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
      <span>复制</span>
    </div>
    <div class="item" @click="doAction('cut')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/>
      </svg>
      <span>剪切</span>
    </div>
    <div class="item" @click="doAction('paste')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
      </svg>
      <span>粘贴</span>
    </div>
    <div class="sep" />
    <div class="item" @click="doAction('selectAll')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2z"/>
      </svg>
      <span>全选</span>
    </div>
    <div class="item" @click="doAction('delete')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
      <span>清空</span>
    </div>
    <div class="sep" />
    <div class="item" @click="doAction('pasteAndSearch')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <span>粘贴并搜索</span>
      <!-- <span v-if="props.clipboardText" class="clipboard-preview">{{ truncate(props.clipboardText, 20) }}</span> -->
    </div>
    <div class="item" @click="doAction('clearAndPaste')">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
      <span>清空并粘贴</span>
      <!-- <span v-if="props.clipboardText" class="clipboard-preview">{{ truncate(props.clipboardText, 20) }}</span> -->
    </div>
  </div>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  width: 160px;
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
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.1s ease;
  font-size: 13px;
}
.item:hover {
  background: var(--tabbar-hover-bg);
}
.item svg {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}
.clipboard-preview {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-tertiary);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>