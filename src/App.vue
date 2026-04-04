<script setup lang="ts">
import { ref } from 'vue'
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
    <UrlBar v-model="currentUrl" @submit="addTab" />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 80px;
}
</style>