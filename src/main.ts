import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

if (window.__APP_ROUTE__) {
  window.location.hash = window.__APP_ROUTE__
}

createApp(App).mount('#app')
