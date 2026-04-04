<script setup lang="ts">
import { onMounted, ref } from 'vue'

const message = ref('')

onMounted(() => {
  window.ipcRenderer.on('main-process-message', (_event: any, msg: string) => {
    message.value = msg
  })
})
</script>

<template>
  <div class="home">
    <div class="hero">
      <div class="logo">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="url(#gradient)"/>
          <path d="M20 32L28 24L36 32L28 40Z" fill="white" fill-opacity="0.9"/>
          <path d="M32 24L44 24L44 28L36 28L36 36L44 36L44 40L32 40L32 28L40 28L32 24Z" fill="white" fill-opacity="0.7"/>
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="64" y2="64">
              <stop stop-color="#6366f1"/>
              <stop offset="1" stop-color="#8b5cf6"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1>Electron + Vite</h1>
      <p class="subtitle">现代化桌面应用开发框架</p>
    </div>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>闪电般的速度</h3>
        <p>Vite 提供极快的开发服务器启动和热模块替换</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🔒</div>
        <h3>安全隔离</h3>
        <p>采用 Context Isolation 和 Sandbox 保护应用安全</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🎯</div>
        <h3>原生体验</h3>
        <p>使用 Electron 构建跨平台桌面应用</p>
      </div>
    </div>

    <div class="tech-stack">
      <h2>技术栈</h2>
      <div class="tech-list">
        <span class="tech-tag">Electron</span>
        <span class="tech-tag">Vite</span>
        <span class="tech-tag">Vue 3</span>
        <span class="tech-tag">TypeScript</span>
      </div>
    </div>

    <div class="info">
      <p v-if="message">主进程时间: {{ message }}</p>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f1220 0%, #1a1b2e 100%);
  color: #eef3ff;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 24px;
  box-sizing: border-box;
}

.hero {
  text-align: center;
  margin-bottom: 60px;
}

.logo {
  margin-bottom: 24px;
}

.logo svg {
  filter: drop-shadow(0 8px 32px rgba(99, 102, 241, 0.4));
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 12px;
  background: linear-gradient(135deg, #eef3ff 0%, #a5b4fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 1.2rem;
  opacity: 0.7;
  margin: 0;
}

.features {
  display: flex;
  gap: 24px;
  max-width: 900px;
  margin-bottom: 48px;
}

.feature {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 28px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 16px;
}

.feature h3 {
  margin: 0 0 10px;
  font-size: 1.1rem;
  font-weight: 600;
}

.feature p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.7;
  line-height: 1.6;
}

.tech-stack {
  text-align: center;
  margin-bottom: 48px;
}

.tech-stack h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0 0 20px;
  opacity: 0.9;
}

.tech-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.tech-tag {
  padding: 8px 18px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 100px;
  font-size: 0.85rem;
  font-weight: 500;
  color: #a5b4fc;
}

.info {
  text-align: center;
  opacity: 0.5;
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .features {
    flex-direction: column;
  }

  h1 {
    font-size: 2rem;
  }
}
</style>
