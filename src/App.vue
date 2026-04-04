<script setup lang="ts">
import { ref } from 'vue'
import TabBar from './components/TabBar.vue'
import UrlBar from './components/UrlBar.vue'
import { TabInfo } from '../electron/tabManager'

const tabs = ref<TabInfo[]>([])

const currentUrl = ref('')

const addTab = () => {
  // const url = currentUrl.value.trim()
  // if (url) {
  //   tabs.value.push({
  //     title: url,
  //     url: url
  //   })
  //   currentUrl.value = ''
  // }
}


const getTabsData = async () => {
  const res = await window.ipcRenderer.invoke('tabs:list')
  tabs.value = res || []
  console.log(res)
}

getTabsData()

// window.ipcRenderer.on('tabs:list:update', () => {
//   console.log('tabs:list:update')
// })


</script>

<template>
  <div class="app-container">
    <TabBar :tabs="tabs" @add="addTab" />
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
