<template>
  <div class="assistant-app" :class="themeClass">
    <!-- 标题栏 -->
    <div class="title-bar">
      <span class="title-text">{{ session?.title || 'AI 辅助' }}</span>
      <div class="title-actions">
        <span v-if="session?.sourceType" class="source-tag">{{ sourceLabel }}</span>
        <button class="settings-btn" @click="showSettings = !showSettings" title="设置">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="close-btn" @click="handleClose">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 设置浮层 -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-item">
        <label>标题</label>
        <input v-model="editTitle" class="settings-input" @blur="saveTitle" @keydown.enter="saveTitle" />
      </div>
      <div class="settings-item">
        <label>来源</label>
        <span class="source-info" :title="session?.sourceId || ''">{{ sourceLabel }}</span>
      </div>
      <div class="settings-divider"></div>
      <button class="settings-delete" @click="handleDelete">删除会话</button>
    </div>

    <!-- 消息区域 -->
    <div ref="scrollRef" class="messages-scroll">
      <div v-if="messages.length === 0" class="empty-hint">
        <span>开始新对话</span>
      </div>
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      <div v-for="(msg, index) in messages" :key="msg.id || index" class="message-item" :class="msg.role">
        <div class="bubble">{{ msg.content }}</div>
      </div>
      <div v-if="loading" class="message-item assistant">
        <div class="bubble loading">{{ currentText || '思考中...' }}</div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area">
      <div class="resize-handle" @mousedown="startResize"></div>
      <div class="input-row">
        <div class="input-wrapper" :style="{ height: inputHeight + 'px' }">
          <textarea
            v-model="inputText"
            class="chat-input"
            placeholder="输入消息..."
            :disabled="loading"
            rows="2"
            @keydown.enter.exact.prevent="handleSend"
          />
          <button class="send-btn" :disabled="!inputText.trim() || loading" @click="handleSend">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useEventListener } from '@vueuse/core'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

interface Session {
  convId: string
  title: string
  sourceType: string | null
  sourceId: string | null
  createdAt: number
  updatedAt: number
}

type ApiMap = Record<string, Record<string, Function>>

const scrollRef = ref<HTMLElement>()
const messages = ref<Message[]>([])
const inputText = ref('')
const loading = ref(false)
const currentText = ref('')
const inputHeight = ref(80)
const isResizing = ref(false)
let resizeStartY = 0
let resizeStartHeight = 0
const themeClass = ref('dark')
const showSettings = ref(false)
const editTitle = ref('')
const errorMsg = ref('')
const session = ref<Session | null>(null)

let windowId: number | null = null
let convId: string | null = null
let apis: ApiMap | null = null
let unsubChunk: (() => void) | null = null
let unsubComplete: (() => void) | null = null
let unsubError: (() => void) | null = null

const sourceLabel = computed(() => {
  const s = session.value
  if (!s) return '未知'
  if (s.sourceType === 'url') {
    try {
      const u = new URL(s.sourceId || '')
      return u.host + (u.pathname !== '/' ? u.pathname : '')
    } catch {
      return s.sourceId || 'URL'
    }
  }
  if (s.sourceType === 'conversation') return `会话: ${s.sourceId}`
  return '未知'
})

function applyTheme(theme: string) {
  themeClass.value = theme === 'light' ? 'light' : 'dark'
}

onMounted(async () => {
  const url = new URL(window.location.href)
  const wid = url.searchParams.get('windowId')
  const convIdParam = url.searchParams.get('convId')
  if (wid) windowId = parseInt(wid, 10)

  apis = window.bridge.getModules(['ai', 'settings', 'assistant'])

  try {
    const theme = await apis.settings.get('theme')
    applyTheme(theme || 'dark')
  } catch {
    applyTheme('dark')
  }

  apis.settings.onThemeChanged(applyTheme)

  const ai = apis.ai
  unsubChunk = ai.onChunk(handleChunk)
  unsubComplete = ai.onComplete(handleComplete)
  unsubError = ai.onError(handleError)

  if (convIdParam) {
    convId = convIdParam
    await loadSession()
    await loadMessages()
  }
})

onUnmounted(() => {
  unsubChunk?.()
  unsubComplete?.()
  unsubError?.()
})

async function loadSession() {
  if (!convId || !apis) return
  session.value = await apis.assistant.getSession(convId) as Session
  if (session.value) {
    editTitle.value = session.value.title
  }
}

async function loadMessages() {
  if (!convId || !apis) return
  const msgs = await apis.assistant.getMessages(convId) as Message[]
  if (msgs && msgs.length > 0) {
    messages.value = msgs
  }
}

function handleChunk(_messageId: string, content: string, _reasoning?: string) {
  errorMsg.value = ''
  currentText.value += content
  scrollToBottom()
}

async function handleComplete(_messageId: string) {
  if (currentText.value && convId && apis) {
    await apis.assistant.addMessage({
      convId,
      role: 'assistant',
      content: currentText.value,
    })
    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: currentText.value,
      createdAt: Date.now(),
    })
  }
  currentText.value = ''
  loading.value = false
  errorMsg.value = ''
  await nextTick()
  scrollToBottom()
}

function handleError(_messageId: string, reason: string) {
  loading.value = false
  currentText.value = ''
  errorMsg.value = reason || '发生错误'
  console.error('Chat error:', reason)
}

function isNearBottom(): boolean {
  const el = scrollRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100
}

function scrollToBottom() {
  nextTick(() => {
    const el = scrollRef.value
    if (el && isNearBottom()) {
      el.scrollTop = el.scrollHeight
    }
  })
}

async function saveTitle() {
  if (!convId || !apis || !editTitle.value.trim()) return
  await apis.assistant.updateTitle(convId, editTitle.value.trim())
  if (session.value) session.value.title = editTitle.value.trim()
}

async function handleDelete() {
  if (!convId || !apis) return
  if (!confirm('确认删除此会话？')) return
  await apis.assistant.deleteSession(convId)
  window.close()
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) { errorMsg.value = '请输入内容'; return }
  if (loading.value) { errorMsg.value = '等待上一条回复结束'; return }
  if (!convId || !apis) { errorMsg.value = '会话未初始化'; return }

  errorMsg.value = ''
  await apis.assistant.addMessage({ convId, role: 'user', content: text })
  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: text,
    createdAt: Date.now(),
  })

  inputText.value = ''
  loading.value = true
  currentText.value = ''
  scrollToBottom()

  try {
    const profile = await apis.ai.getActiveProfile()
    await apis.ai.chat({
      conversationId: convId,
      messageId: `msg-${Date.now()}`,
      apiUrl: profile?.apiUrl || '',
      apiKey: profile?.apiKey || '',
      providerType: profile?.providerType || 'openai',
      model: profile?.model || '',
      messages: messages.value.map(m => ({ role: m.role, content: m.content })),
    })
  } catch (err) {
    loading.value = false
    errorMsg.value = String(err)
    console.error('Send error:', err)
  }
}

function handleClose() {
  if (windowId !== null && apis) {
    apis.assistant.close(windowId)
  } else {
    window.close()
  }
}

function startResize(e: MouseEvent) {
  e.preventDefault()
  resizeStartY = e.clientY
  resizeStartHeight = inputHeight.value
  isResizing.value = true
}

useEventListener(window, 'mousemove', (e: MouseEvent) => {
  if (!isResizing.value) return
  const maxHeight = window.innerHeight / 2
  const delta = resizeStartY - e.clientY
  inputHeight.value = Math.min(Math.max(44, resizeStartHeight + delta), maxHeight)
})

useEventListener(window, 'mouseup', () => {
  isResizing.value = false
})
</script>

<style scoped>
.assistant-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a0b;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 8px 0 12px;
  background: #18181b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.title-text {
  font-size: 13px;
  color: #a1a1a6;
  flex: 1;
}

.title-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.source-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #a1a1a6;
  margin-right: 4px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-btn,
.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #a1a1a6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.settings-btn:hover,
.close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* 设置浮层 */
.settings-panel {
  position: absolute;
  top: 36px;
  right: 8px;
  width: 220px;
  background: #232326;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.settings-item {
  margin-bottom: 12px;
}

.settings-item label {
  display: block;
  font-size: 11px;
  color: #a1a1a6;
  margin-bottom: 4px;
}

.settings-input {
  width: 100%;
  padding: 6px 8px;
  background: #0a0a0b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #f5f5f7;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.settings-input:focus {
  border-color: #34d399;
}

.source-info {
  font-size: 12px;
  color: #f5f5f7;
}

.settings-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 12px 0;
}

.settings-delete {
  width: 100%;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.15);
  border: none;
  border-radius: 4px;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
}

.settings-delete:hover {
  background: rgba(239, 68, 68, 0.25);
}

.messages-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  box-sizing: border-box;
  width: 100%;
}

.messages-scroll::-webkit-scrollbar {
  display: none;
}
.messages-scroll {
  scrollbar-width: none;
}

.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: #a1a1a6;
  font-size: 14px;
}

.error-msg {
  padding: 8px 16px;
  color: #f87171;
  font-size: 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  margin-bottom: 8px;
}

.message-item {
  display: flex;
  padding: 6px 0;
}

.message-item.user {
  justify-content: flex-end;
}

.message-item.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-item.user .bubble {
  background: #232326;
  border-bottom-right-radius: 4px;
  color: #f5f5f7;
}

.message-item.assistant .bubble {
  background: #18181b;
  border-bottom-left-radius: 4px;
  color: #f5f5f7;
}

.bubble.loading {
  color: #a1a1a6;
  font-style: italic;
}

.input-area {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #18181b;
}

.resize-handle {
  height: 6px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize-handle::after {
  content: '';
  width: 32px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.15);
  transition: background 0.15s;
}

.resize-handle:hover::after {
  background: rgba(255, 255, 255, 0.3);
}

.input-row {
  display: flex;
  padding: 0 16px 12px;
}

.input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: #0a0a0b;
  transition: border-color 0.15s;
}

.input-wrapper:focus-within {
  border-color: #34d399;
}

.chat-input {
  flex: 1;
  padding: 10px 44px 10px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #f5f5f7;
  font-size: 14px;
  outline: none;
  resize: none;
  line-height: 1.5;
  overflow-y: auto;
}

.chat-input:focus {
  border-color: #34d399;
}

.chat-input::placeholder {
  color: #6e6e73;
}

.chat-input:disabled {
  opacity: 0.5;
}

.send-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: #34d399;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, opacity 0.15s;
  flex-shrink: 0;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn:not(:disabled):hover {
  background: #6ee7b7;
}

/* ===== 白天模式 ===== */
.light .assistant-app {
  background: #fafafa;
  border-color: #e4e4e7;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
}

.light .title-bar {
  background: #f4f4f5;
  border-color: #e4e4e7;
}

.light .title-text {
  color: #86868b;
}

.light .source-tag {
  background: rgba(0, 0, 0, 0.06);
  color: #86868b;
}

.light .settings-panel {
  background: #fff;
  border-color: #e4e4e7;
}

.light .settings-input {
  background: #f4f4f5;
  border-color: #e4e4e7;
  color: #1d1d1f;
}

.light .settings-delete {
  background: rgba(239, 68, 68, 0.1);
}

.light .messages-scroll {
  background: #fafafa;
}

.light .empty-hint {
  color: #86868b;
}

.light .error-msg {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.light .message-item.user .bubble {
  background: #f4f4f5;
  color: #1d1d1f;
}

.light .message-item.assistant .bubble {
  background: #fff;
  color: #1d1d1f;
}

.light .bubble.loading {
  color: #86868b;
}

.light .input-area {
  background: #f4f4f5;
  border-color: #e4e4e7;
}

.light .input-wrapper {
  background: #fff;
  border-color: #e4e4e7;
}

.light .input-wrapper:focus-within {
  border-color: #10b981;
}

.light .chat-input {
  color: #1d1d1f;
}

.light .chat-input::placeholder {
  color: #a1a1a6;
}

.light .send-btn {
  background: #10b981;
}

.light .send-btn:not(:disabled):hover {
  background: #059669;
}
</style>
