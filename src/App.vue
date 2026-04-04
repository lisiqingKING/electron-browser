<script setup lang="ts">
import { ref } from 'vue'
import TabBar from './components/TabBar.vue'
import UrlBar from './components/UrlBar.vue'

const tabs = ref([
  { title: '首页', url: 'home.html' }
])

const currentUrl = ref('')

const addTab = () => {
  const url = currentUrl.value.trim()
  if (url) {
    tabs.value.push({
      title: url,
      url: url
    })
    currentUrl.value = ''
  }
}
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
