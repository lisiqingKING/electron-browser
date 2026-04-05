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

      if(curTabInfo?.title === '新建标签页') {
        currentUrl.value = ''
      } else {
        if(isUrl(curTabInfo?.url)) {
          currentUrl.value = curTabInfo.url
        }
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

window.ipcRenderer.on('tab:updated', (_event, tabInfo: TabInfo) => {
  const index = tabs.value.findIndex(t => t.id === tabInfo.id)
  if (index !== -1) {
    tabs.value[index] = tabInfo
  }
})

window.ipcRenderer.on('ipcMain:tabs:update', () => {
  getTabsData()
})

window.ipcRenderer.on('tab:url-changed', (_event, data: { id: string; url: string }) => {
  if (data.id === currentTabId.value) {
    currentUrl.value = data.url
  }
})

window.ipcRenderer.on('tab:navigation-state', (_event, data: { id: string; canGoBack: boolean; canGoForward: boolean }) => {
  if (data.id === currentTabId.value) {
    canGoBack.value = data.canGoBack
    canGoForward.value = data.canGoForward
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