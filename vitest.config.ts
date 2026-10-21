import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@main', replacement: path.resolve(__dirname, 'electron') },
      { find: '@renderer', replacement: path.resolve(__dirname, 'src') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // electron 必须在 alias 里替换：vitest 默认把 node_modules 下的依赖外部化，
      // 'electron' 会以真实 CJS 被 Node 加载，命名导出检查会直接报错
      { find: /^electron$/, replacement: path.resolve(__dirname, 'test/mocks/electron.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        // electron* 系列必须 inline：外部化后 Node 直接加载 node_modules 下的真实 CJS，
        // 命名导出会直接报错（'electron' 还会让 resolve.alias 失效）。
        // 这里的 'electron' 是前缀匹配，覆盖 electron-context-menu 及其依赖
        // electron-dl / electron-is-dev —— 它们同样是 CJS 且用命名导出。
        // 别为了「精确匹配」改成正则：漏掉其中一个依赖，测试会整片红。
        inline: ['electron'],
      },
    },
  },
})
