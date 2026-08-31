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
      @openAI="openInternalPage('createAI')"
      @toggleFavorite="handleToggleFavorite"
    />
    <FavoritesQuick @select="handleFavoriteSelect" />
  </div>
</template>

<script setup lang="ts">
import TabBar from './components/TabBar.vue'
import UrlBar from './components/UrlBar.vue'
import FavoritesQuick from './components/FavoritesQuick.vue'
import { ref, watch, onUnmounted } from 'vue'
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

// 模块引用 — bridge 在 preload 阶段已注入，setup 顶层即可访问
const tabsMod = window.bridge.getModules(['tabs']).tabs
const favoritesMod = window.bridge.getModules(['favorites']).favorites
const settingsMod = window.bridge.getModules(['settings']).settings

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
    isFavorited.value = await favoritesMod.check(url)
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
  tabsMod.updateUrl(url)
}

const addTabByButton = async () => {
  await tabsMod.createDefault()
}

const switchTab = async (tabId: string) => {
  await tabsMod.switch(tabId)
  currentTabVersion++
}

const closeTab = async (tabId: string) => {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab?.isHome) return
  await tabsMod.close(tabId)
}

const onTabInfoChanged = (tabInfo: TabInfo) => {
  const index = tabs.value.findIndex(t => t.id === tabInfo.id)
  if (index !== -1) {
    tabs.value[index] = tabInfo
  }
  if (tabInfo.id === currentTabId.value) {
    if (isNewTabUrl(tabInfo.url)) {
      currentUrl.value = ''
    } else if (tabInfo.loadError) {
      currentUrl.value = tabInfo.loadError.url
    } else {
      currentUrl.value = tabInfo.url
    }
  }
  const { id, title, url, favicon } = tabInfo
  if (id) {
    tabsMod.updateInfo(id, { title, url, favicon })
  }
}

const onTabListChanged = (data: { tabs: TabInfo[], currentTabId: string | null }) => {
  tabs.value = data.tabs
  currentTabId.value = data.currentTabId
}

const onTabCurrentChanged = (data: { currentTabId: string }) => {
  currentTabId.value = data.currentTabId
}

const onTabCanNavigate = (data: { id: string; canGoBack: boolean; canGoForward: boolean }) => {
  if (data.id === currentTabId.value) {
    canGoBack.value = data.canGoBack
    canGoForward.value = data.canGoForward
  }
}

const onTabLoading = (data: { id: string; isLoading: boolean }) => {
  const index = tabs.value.findIndex(t => t.id === data.id)
  if (index !== -1) {
    tabs.value[index].isLoading = data.isLoading
  }
}

const handleGoBack = () => {
  tabsMod.goBack()
}

const handleGoForward = () => {
  tabsMod.goForward()
}

const handleFavoriteSelect = async (url: string) => {
  await tabsMod.create({ title: '加载中...', url }, currentTabId.value || undefined)
}

const handleToggleFavorite = async () => {
  if (!currentUrl.value) return
  try {
    const tab = tabs.value.find(t => t.id === currentTabId.value)

    if (isFavorited.value) {
      isFavorited.value = await favoritesMod.toggle(currentUrl.value, '', undefined)
      return
    }

    if (tab?.isLoading) {
      console.log('[handleToggleFavorite] 页面加载中，不允许收藏')
      return
    }

    const title = tab?.title || ''
    const favicon = tab?.favicon || ''

    if (!title || title === currentUrl.value) {
      console.log('[handleToggleFavorite] 标题无效，不允许收藏')
      return
    }

    if (!favicon) {
      console.log('[handleToggleFavorite] 图标无效，不允许收藏')
      return
    }

    isFavorited.value = await favoritesMod.toggle(currentUrl.value, title, favicon)
  } catch (e) {
    console.error('[handleToggleFavorite]', e)
  }
}

const openInternalPage = async (method: string) => {
  await tabsMod[method](currentTabId.value || undefined)
}

const onThemeChanged = (theme: string) => {
  if (theme === 'light') {
    document.documentElement.classList.add('light')
    document.documentElement.classList.remove('dark')
  } else {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  }
}

const handleMainReadyForPopup = () => {
  tabsMod.showRestorePrompt()
}

const onFavoritesChanged = async () => {
  if (currentUrl.value && !isNewTabUrl(currentUrl.value)) {
    isFavorited.value = await favoritesMod.check(currentUrl.value)
  }
}

// 事件监听 — 必须在 setup 顶层注册，确保在 did-finish-load 之前完成
window.bridge.on('tab:info-changed', onTabInfoChanged)
window.bridge.on('tab:list-changed', onTabListChanged)
window.bridge.on('tab:current-changed', onTabCurrentChanged)
window.bridge.on('tab:can-navigate', onTabCanNavigate)
window.bridge.on('tab:loading', onTabLoading)
window.bridge.on('settings:theme-changed', onThemeChanged)
window.bridge.on('main:ready-for-popup', handleMainReadyForPopup)
window.bridge.on('favorites:changed', onFavoritesChanged)

// 初始化主题
settingsMod.get('theme').then((theme: string) => {
  onThemeChanged(theme || 'dark')
}).catch(() => onThemeChanged('dark'))

// 恢复标签弹窗（主窗口且有 isMain 参数）
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.get('isMain') === 'true') {
  tabsMod.showRestorePrompt()
}

// 清理
onUnmounted(() => {
  window.bridge.off('tab:info-changed', onTabInfoChanged)
  window.bridge.off('tab:list-changed', onTabListChanged)
  window.bridge.off('tab:current-changed', onTabCurrentChanged)
  window.bridge.off('tab:can-navigate', onTabCanNavigate)
  window.bridge.off('tab:loading', onTabLoading)
  window.bridge.off('settings:theme-changed', onThemeChanged)
  window.bridge.off('main:ready-for-popup', handleMainReadyForPopup)
  window.bridge.off('favorites:changed', onFavoritesChanged)
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
}
</style>