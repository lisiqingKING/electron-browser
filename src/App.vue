<script setup lang="ts">
import { ref, watch } from 'vue'
import TabBar from './components/TabBar.vue'
import UrlBar from './components/UrlBar.vue'
import { isUrl } from './utils'

interface TabInfo {
  title: string
  url: string
  time?: number
  id?: string
  wcId?: number
  isLoading?: boolean
}

interface Bookmark {
  name: string
  url: string
  icon: string
  onClick?: () => Promise<void>
}

const tabs = ref<TabInfo[]>([])
const currentTabId = ref<string | null>(null)
const currentUrl = ref('')
const canGoBack = ref(false)
const canGoForward = ref(false)

// 用于避免竞态：追踪当前 tab 的最新版本号
let currentTabVersion = 0


const updateCurrentUrl = () => {
   if(typeof currentTabId.value === 'string') {
      const curTabInfo = tabs.value.find(item => item.id === currentTabId.value)
      if(!curTabInfo) return

      const url = curTabInfo.url

      // 内置子应用默认页（internal-app）不显示 URL
      if (url === 'lsqapp://internal-app') {
        currentUrl.value = ''
      } else {
        currentUrl.value = url
      }
    }
}

watch(currentTabId, () => {
  updateCurrentUrl()
})

const addTab = async () => {
  const input = currentUrl.value.trim()
  if (!input) return

  let url = input

  // apps:// 协议直接发送，不走搜索
  if (!input.startsWith('apps://') && !isUrl(input)) {
    url = `https://www.baidu.com/s?wd=${encodeURIComponent(input)}`
    currentUrl.value = url
  }

  window.ipcRenderer.send('tabs:updateUrl', url)
}

const addTabByButton = async () => {
  const newTabId = await window.ipcRenderer.invoke('tabs:createDefault')
  await getTabsData()
  if (newTabId) {
    currentTabId.value = newTabId
  }
}

const getTabsData = async () => {
  const res = await window.ipcRenderer.invoke('tabs:list')
  tabs.value = res || []
  // 初始化时 或 当前tab不在列表中时，设置 currentTabId
  if (!currentTabId.value || (res && !res.some((t: TabInfo) => t.id === currentTabId.value))) {
    currentTabId.value = res?.[res.length - 1]?.id || null
  }
}

getTabsData()

const switchTab = async (tabId: string) => {
  currentTabId.value = tabId
  await window.ipcRenderer.invoke('tabs:switch', tabId)
  currentTabVersion++  // 切换完成后版本号+1，忽略切换过程中的旧事件
}

const closeTab = async (tabId: string) => {
  const newCurTabId = await window.ipcRenderer.invoke('tabs:close', tabId)
  await getTabsData()
  if (newCurTabId) {
    currentTabId.value = newCurTabId
  }
}

window.ipcRenderer.on('tab:info-changed', (_event, tabInfo: TabInfo) => {
  const index = tabs.value.findIndex(t => t.id === tabInfo.id)
  if (index !== -1) {
    tabs.value[index] = tabInfo
  }
  if (tabInfo.id === currentTabId.value) {
    // 内置子应用默认页（internal-app）不显示 URL
    if (tabInfo.url === 'lsqapp://internal-app') {
      currentUrl.value = ''
    } else {
      currentUrl.value = tabInfo.url
    }
  }
})

window.ipcRenderer.on('tab:list-changed', async () => {
  const prevCount = tabs.value.length
  await getTabsData()
  // 如果 tab 数量增加了，说明是新打开的标签，切换到最后一个
  if (tabs.value.length > prevCount) {
    currentTabId.value = tabs.value[tabs.value.length - 1]?.id || null
  }
})

window.ipcRenderer.on('tab:can-navigate', (_event, data: { id: string; canGoBack: boolean; canGoForward: boolean }) => {
  // 只有当前 tab 的导航状态才更新
  // 用闭包捕获当前的 version，如果后续有新的 switch，version 会变化，这个旧事件就会被忽略
  const expectedTabId = currentTabId.value
  const expectedVersion = currentTabVersion
  if (data.id === expectedTabId) {
    canGoBack.value = data.canGoBack
    canGoForward.value = data.canGoForward
    console.log('[tab:can-navigate] updated, version:', expectedVersion, 'canGoBack:', data.canGoBack)
  } else {
    console.log('[tab:can-navigate] ignored, event tabId:', data.id, 'expected tabId:', expectedTabId)
  }
})

window.ipcRenderer.on('tab:loading', (_event, data: { id: string; isLoading: boolean }) => {
  const index = tabs.value.findIndex(t => t.id === data.id)
  if (index !== -1) {
    tabs.value[index].isLoading = data.isLoading
  }
})

const handleGoBack = () => {
  window.ipcRenderer.send('tabs:goBack')
}

const handleGoForward = () => {
  window.ipcRenderer.send('tabs:goForward')
}

const openHistory = async () => {
  const newTabId = await window.ipcRenderer.invoke('tabs:createHistory')
  await getTabsData()
  if (newTabId) {
    currentTabId.value = newTabId
  }
}

const openDownloads = async () => {
  const newTabId = await window.ipcRenderer.invoke('tabs:createDownloads')
  await getTabsData()
  if (newTabId) {
    currentTabId.value = newTabId
  }
}

const bookmarks: Bookmark[] = [
  {
    name: 'Vite',
    url: 'https://vitejs.cn/vite3-cn/',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="#646cff"><path d="M12.78 1.25c-3.17-.13-6.42 1.17-8.53 3.39-1.72 1.81-2.75 4.22-2.75 6.74 0 .86.1 1.7.29 2.51L1.03 15.72c-.37.49-.06 1.14.55 1.14h4.81l-.73 4.89c-.09.56.37 1.03.92 1.03l5.41-.04c.26 0 .49-.11.65-.28l5.89-5.89c.17-.17.28-.39.28-.65l-.04-5.41c0-.55.47-1.01 1.03-.92l4.89.73V5.04c0-.61-.65-.92-1.14-.55L12.12 5.24c.81-.19 1.65-.29 2.51-.29.92 0 1.81.12 2.66.34l1.24-1.24c.16-.16.25-.38.25-.62 0-.52-.42-.94-.94-.94-.24 0-.46.09-.62.25L13.06 6.9C10.27 5.32 7.04 4.5 3.91 5.4c-.52.15-.99-.27-1.11-.78L2.6 3.2C2.41 2.47 2.94 1.75 3.69 1.58 7.52.53 11.46 1.77 14.35 5.03l.65-.77c.32-.38.18-.93-.28-1.12-3.35-1.42-7.22-.8-10.1 1.65-.17.15-.4.22-.63.22-.28 0-.56-.12-.77-.35l-.78-.94C.79 2.33.26 2.1.09 1.55c-.17-.55.13-1.14.69-1.31.56-.17 1.14.13 1.31.69.1.31.4.52.73.52.13 0 .25-.03.37-.1 2.14-1.82 4.99-2.5 7.61-1.84.51.13.8.65.67 1.16-.13.51-.65.8-1.16.67-.96-.24-1.98-.27-2.97-.09l.78.94c.77.93 1.16 2.06 1.16 3.2 0 .52.42.94.94.94.28 0 .56-.12.77-.35l.65-.77c1.89 2.22 3.03 5.04 3.03 8.06 0 1.55-.28 3.06-.81 4.45l1.24-1.24c.16-.16.25-.38.25-.62 0-.52-.42-.94-.94-.94-.24 0-.46.09-.62.25L16.6 16.7c-.51.1-1.03-.2-1.14-.72-.44-2.02-1.38-3.84-2.68-5.28-.33-.36-.3-.9.06-1.23l.78-.78c.39-.39.39-1.02 0-1.41-.38-.38-1.02-.38-1.41 0l-.78.78c-.33.33-.87.39-1.23.06C8.96 6.86 7.14 6 5.12 6c-.51 0-.94-.42-.94-.94 0-.24.09-.46.25-.62l1.24-1.24C4.87 4.56 4 6.17 4 7.98c0 3.14 1.74 5.91 4.38 7.38.41.23.58.74.35 1.15-.23.41-.74.58-1.15.35C3.68 14.76 2 12.15 2 9.21c0-2.34.94-4.53 2.64-6.18C6.21 1.59 9.38.18 12.78.25c.52.01.94.43.93.95 0 .24-.09.46-.25.62l-1.24 1.24c-.37-.19-.77-.35-1.19-.46-.51-.13-1.03.16-1.16.67-.13.51.16 1.03.67 1.16.26.07.52.16.77.27l-.78.78c-.39.39-.39 1.02 0 1.41.38.38 1.02.38 1.41 0l.78-.78c.33-.33.87-.39 1.23-.06 1.44 1.3 2.37 3.12 2.67 5.28.11.51.63.82 1.14.72l1.24-1.24c.16-.16.38-.25.62-.25.52 0 .94.42.94.94 0 .24-.09.46-.25.62l-1.24 1.24c.53-1.39.81-2.9.81-4.45 0-1.55-.28-3.06-.81-4.45l1.24-1.24c.16-.16.25-.38.25-.62.01-.52-.41-.94-.93-.95z"/></svg>`
  },
  {
    name: 'Vue',
    url: 'https://vuejs.org',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="#42b883"><path d="M24 1.61h-9.94L12 5.16 9.94 1.61H0l12 20.78zm-18.39.77h5.16l-2.58 4.45L12 21.95l4.81-8.31L17.23 2.38h5.16L12 10.09z"/></svg>`
  },
  {
    name: 'Electron',
    url: 'https://electronjs.org',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="#9E9EB3"><circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" fill="none" stroke="#9E9EB3" stroke-width="1.2"/><ellipse cx="12" cy="12" rx="10" ry="4.5" fill="none" stroke="#9E9EB3" stroke-width="1.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" fill="none" stroke="#9E9EB3" stroke-width="1.2" transform="rotate(-60 12 12)"/></svg>`
  },
  {
    name: 'AI',
    url: 'lsqapp://internal-app/ai',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="#10a37f"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>`
  },
  {
    name: '下载',
    url: '__downloads__',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    onClick: openDownloads,
  },
]

const openBookmark = async (url: string) => {
  const newTabId = await window.ipcRenderer.invoke('tabs:create', { title: '', url })
  await getTabsData()
  if (newTabId) {
    currentTabId.value = newTabId
  }
}
</script>

<template>
  <div class="app-container">
    <TabBar
      :tabs="tabs"
      :current-tab-id="currentTabId"
      @switch="switchTab"
      @close="closeTab"
      @add="addTabByButton"
    />
    <UrlBar
      v-model="currentUrl"
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      @submit="addTab"
      @goBack="handleGoBack"
      @goForward="handleGoForward"
      @openHistory="openHistory"
      @add="addTabByButton"
    />
    <div class="bookmarks-bar">
      <button
        v-for="bookmark in bookmarks"
        :key="bookmark.url"
        class="bookmark-item"
        @click="bookmark.onClick ? bookmark.onClick() : openBookmark(bookmark.url)"
      >
        <span class="bookmark-icon" v-html="bookmark.icon" />
        <span>{{ bookmark.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
}

.bookmarks-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  height: 30px;
  background: #1a1a1a;
  flex-shrink: 0;
  overflow-x: auto;
}

.bookmarks-bar::-webkit-scrollbar {
  display: none;
}

.bookmark-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #9aa0a6;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.bookmark-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8eaed;
}

.bookmark-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.bookmark-icon :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>