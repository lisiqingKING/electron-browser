<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import TabBar from './components/TabBar.vue'
import UrlBar from './components/UrlBar.vue'
import FavoritesQuick from './components/FavoritesQuick.vue'
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
const isFavorited = ref(false)

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

// 监听 URL 变化，检查收藏状态
watch(currentUrl, async (url) => {
  if (!url || url.trim() === '' || isNewTabUrl(url)) {
    isFavorited.value = false
    return
  }
  try {
    isFavorited.value = await window.ipcRenderer.invoke('favorites:check', url)
  } catch {
    isFavorited.value = false
  }
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
    if (!/^(https?:\/\/|lsqapp:\/\/)/i.test(input)) {
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
  await window.ipcRenderer.invoke('tabs:createDefault')
  // 标签列表通过 tab:list-changed 事件更新
}

const switchTab = async (tabId: string) => {
  await window.ipcRenderer.invoke('tabs:switch', tabId)
  // 当前标签通过 tab:current-changed 事件更新
  currentTabVersion++
}

const closeTab = async (tabId: string) => {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab?.isHome) return
  await window.ipcRenderer.invoke('tabs:close', tabId)
  // 标签列表通过 tab:list-changed 事件更新
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
  // 同步更新数据库（单向数据流：事件 -> IPC -> DB）
  const { id, title, url, favicon } = tabInfo
  if (id) {
    window.ipcRenderer.send('tabs:updateInfo', id, { title, url, favicon })
  }
})

window.ipcRenderer.on('tab:list-changed', (_event, data: { tabs: TabInfo[], currentTabId: string | null }) => {
  // 标签列表变化，更新列表和当前标签
  tabs.value = data.tabs
  currentTabId.value = data.currentTabId
})

window.ipcRenderer.on('tab:current-changed', (_event, data: { currentTabId: string }) => {
  // 只切换当前标签，列表不变
  currentTabId.value = data.currentTabId
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

const handleFavoriteSelect = async (url: string) => {
  await window.ipcRenderer.invoke('tabs:create', { title: '加载中...', url }, currentTabId.value || undefined)
}

const handleToggleFavorite = async () => {
  if (!currentUrl.value) return
  try {
    const tab = tabs.value.find(t => t.id === currentTabId.value)

    // 取消收藏：无限制
    if (isFavorited.value) {
      isFavorited.value = await window.ipcRenderer.invoke('favorites:toggle', currentUrl.value, '', undefined)
      return
    }

    // 添加收藏：需要页面加载完成 + 有效标题 + 有效图标
    if (tab?.isLoading) {
      console.log('[handleToggleFavorite] 页面加载中，不允许收藏')
      return
    }

    const title = tab?.title || ''
    const favicon = tab?.favicon || ''

    // 验证标题：不能为空且不能是 URL（fallback 的情况）
    if (!title || title === currentUrl.value) {
      console.log('[handleToggleFavorite] 标题无效，不允许收藏')
      return
    }

    // 验证图标：必须有
    if (!favicon) {
      console.log('[handleToggleFavorite] 图标无效，不允许收藏')
      return
    }

    isFavorited.value = await window.ipcRenderer.invoke('favorites:toggle', currentUrl.value, title, favicon)
  } catch (e) {
    console.error('[handleToggleFavorite]', e)
  }
}

const openInternalPage = async (channel: string) => {
  await window.ipcRenderer.invoke(channel, currentTabId.value || undefined)
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
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('isMain') === 'true') {
    window.ipcRenderer.send('tabs:showRestorePrompt')
  }
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
      :is-favorited="isFavorited"
      @submit="addTab"
      @goBack="handleGoBack"
      @goForward="handleGoForward"
      @add="addTabByButton"
      @openAI="openInternalPage('tabs:createAI')"
      @toggleFavorite="handleToggleFavorite"
    />
    <FavoritesQuick @select="handleFavoriteSelect" />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
}
</style>