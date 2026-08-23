import { createApp } from 'vue'
import './styles/main.scss'
import App from './App.vue'

if (window.__APP_ROUTE__) {
  window.location.hash = window.__APP_ROUTE__
}

createApp(App).mount('#app')
