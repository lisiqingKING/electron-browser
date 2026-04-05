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
  await window.ipcRenderer.invoke('tabs:createDefault')
  await getTabsData()
}

const getTabsData = async () => {
  const res = await window.ipcRenderer.invoke('tabs:list')
  tabs.value = res || []
  if (res && res.length > 0) {
    currentTabId.value = res[res.length - 1].id || null
  }
  console.log(res)
}

getTabsData()

const switchTab = async (tabId: string) => {
  await window.ipcRenderer.invoke('tabs:switch', tabId)
  currentTabId.value = tabId
}

const closeTab = async (tabId: string) => {
  await window.ipcRenderer.invoke('tabs:close', tabId)
  await getTabsData()
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

window.ipcRenderer.on('tab:list-changed', () => {
  getTabsData()
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
  await window.ipcRenderer.invoke('tabs:createHistory')
  await getTabsData()
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
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 80px;
}
</style>