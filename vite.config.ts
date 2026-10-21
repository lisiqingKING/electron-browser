import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'

const alias = {
  '@main': path.resolve(__dirname, 'electron'),
  '@renderer': path.resolve(__dirname, 'src'),
  '@': path.resolve(__dirname, 'src'),
}

// https://vitejs.dev/config/
export default defineConfig({
  resolve: { alias },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/tokens" as *; @use "@/styles/mixins" as *;`,
        api: 'modern-compiler',
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.join(__dirname, 'index.html'),
        popup: path.join(__dirname, 'popup.html'),
      },
    },
  },
  plugins: [
    vue(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          resolve: { alias },
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'preload/preload.ts'),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    }),
  ],
})
