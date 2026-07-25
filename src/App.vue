<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import TabBar from './components/TabBar.vue'
import UrlBar from './components/UrlBar.vue'
import { isUrl, isNewTabUrl } from './utils'

interface TabInfo {
  title: string
  url: string
  time?: number
  id?: string
  wcId?: number
  isLoading?: boolean
  favicon?: string
  isHome?: boolean
  loadError?: {
    url: string
    code: number
    message: string
  }
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

      // 新标签页不显示 URL
      if (isNewTabUrl(curTabInfo.url)) {
        currentUrl.value = ''
        return
      }

      // 加载失败时，显示原始 URL（非错误页面 URL）
      if (curTabInfo.loadError) {
        currentUrl.value = curTabInfo.loadError.url
      } else {
        currentUrl.value = curTabInfo.url
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

  // apps:// 协议直接发送
  if (input.startsWith('apps://')) {
    // 不处理
  } else if (isUrl(input)) {
    // 如果是 URL 但没有协议，补全 https://
    if (!/^(https?:\/\/|lsqapp:\/\/|open-lsqapp:\/\/)/i.test(input)) {
      url = `https://${input}`
    }
  } else {
    // 作为搜索关键词
    url = `https://www.baidu.com/s?wd=${encodeURIComponent(input)}`
  }

  currentUrl.value = url
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
  // 合并时保留已有的 favicon（DB 可能尚未更新）
  const prev = tabs.value
  tabs.value = (res || []).map((t: TabInfo) => {
    if (!t.favicon) {
      const old = prev.find(p => p.id === t.id)
      if (old?.favicon) t.favicon = old.favicon
    }
    return t
  })
  // 初始化时 或 当前tab不在列表中时，设置 currentTabId
  if (!currentTabId.value || (res && !res.some((t: TabInfo) => t.id === currentTabId.value))) {
    // 优先选中首页 tab，否则选最后一个
    const homeTab = res?.find((t: TabInfo) => t.isHome)
    currentTabId.value = homeTab?.id || res?.[res.length - 1]?.id || null
  }
}

getTabsData()

const switchTab = async (tabId: string) => {
  currentTabId.value = tabId
  await window.ipcRenderer.invoke('tabs:switch', tabId)
  currentTabVersion++  // 切换完成后版本号+1，忽略切换过程中的旧事件
}

const closeTab = async (tabId: string) => {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab?.isHome) return  // 首页不可关闭
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
    // 新标签页不显示 URL
    if (isNewTabUrl(tabInfo.url)) {
      currentUrl.value = ''
    } else if (tabInfo.loadError) {
      // 加载失败时，显示原始 URL
      currentUrl.value = tabInfo.loadError.url
    } else {
      currentUrl.value = tabInfo.url
    }
  }
})

window.ipcRenderer.on('tab:list-changed', async (_event, data?: { newCurTabId?: string }) => {
  const prevCount = tabs.value.length
  await getTabsData()
  // 批量关闭操作附带 newCurTabId
  if (data?.newCurTabId) {
    currentTabId.value = data.newCurTabId
  } else if (tabs.value.length > prevCount) {
    // 如果 tab 数量增加了，说明是新打开的标签，切换到最后一个
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

const openSettings = async () => {
  const newTabId = await window.ipcRenderer.invoke('tabs:createSettings')
  await getTabsData()
  if (newTabId) {
    currentTabId.value = newTabId
  }
}

// 加载主题设置
const loadTheme = async () => {
  try {
    const theme = await window.ipcRenderer.invoke('settings:get', 'theme')
    if (theme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  } catch {
    // 默认黑夜模式
    document.documentElement.classList.add('dark')
  }
}

// 监听主题变化
window.ipcRenderer.on('settings:theme-changed', (_event, theme: string) => {
  if (theme === 'light') {
    document.documentElement.classList.remove('dark')
  } else {
    document.documentElement.classList.add('dark')
  }
})

onMounted(() => {
  loadTheme()
})



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
      @openSettings="openSettings"
      @add="addTabByButton"
    />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
}
</style>