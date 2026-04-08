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
  isLoading?: boolean
}

const tabs = ref<TabInfo[]>([])
const currentTabId = ref<string | null>(null)
const currentUrl = ref('')
const canGoBack = ref(false)
const canGoForward = ref(false)


const updateCurrentUrl = () => {
   if(typeof currentTabId.value === 'string') {
      const curTabInfo = tabs.value.find(item => item.id === currentTabId.value)
      if(!curTabInfo) return

      // 如果是网址则更新，否则（本地文件）清空
      if(isUrl(curTabInfo?.url)) {
        currentUrl.value = curTabInfo.url
      } else {
        currentUrl.value = ''
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

  if (!isUrl(input)) {
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
  await window.ipcRenderer.invoke('tabs:switch', tabId)
  currentTabId.value = tabId
}

const closeTab = async (tabId: string) => {
  const newCurTabId = await window.ipcRenderer.invoke('tabs:close', tabId)
  await getTabsData()
  if (newCurTabId) {
    currentTabId.value = newCurTabId
  }
}

window.ipcRenderer.on('tab:info-changed', (_event, tabInfo: TabInfo) => {
  console.log('[tab:info-changed] tabInfo:', tabInfo)
  const index = tabs.value.findIndex(t => t.id === tabInfo.id)
  if (index !== -1) {
    tabs.value[index] = tabInfo
  }
  if (tabInfo.id === currentTabId.value) {
    currentUrl.value = isUrl(tabInfo.url) ? tabInfo.url : ''
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
  // 切换 tab 时，事件先于 currentTabId 更新到达，所以直接更新
  canGoBack.value = data.canGoBack
  canGoForward.value = data.canGoForward
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

const bookmarks = [
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
      @add="addTabByButton"
      @switch="switchTab"
      @close="closeTab"
    />
    <UrlBar
      v-model="currentUrl"
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      @submit="addTab"
      @goBack="handleGoBack"
      @goForward="handleGoForward"
      @openHistory="openHistory"
    />
    <div class="bookmarks-bar">
      <button
        v-for="bookmark in bookmarks"
        :key="bookmark.url"
        class="bookmark-item"
        @click="openBookmark(bookmark.url)"
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
  border-top: 1px solid #2d2d2d;
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