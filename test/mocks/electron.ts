/**
 * electron 的测试替身。
 *
 * 通过 vitest.config.ts 的 resolve.alias 生效 —— 必须在 alias 里替换，
 * 因为 vitest 默认把 node_modules 下的依赖外部化，'electron' 会以真实 CJS
 * 被 Node 加载，命名导出检查会直接报错。
 *
 * 所有可被断言的 API 都用 vi.fn()，测试里可直接 vi.mocked(...) 读调用记录。
 * 未知导出统一返回缓存的 vi.fn()，避免每个测试文件重复补 stub。
 */
import { vi } from 'vitest'

export const app = {
  getPath: vi.fn(() => process.cwd()),
  getName: vi.fn(() => 'electron-vue-app'),
  getVersion: vi.fn(() => '0.0.1'),
  getAppPath: vi.fn(() => process.cwd()),
  isPackaged: false,
  on: vi.fn(),
  once: vi.fn(),
  quit: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
}

export const ipcMain = {
  handle: vi.fn(),
  handleOnce: vi.fn(),
  removeHandler: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
}

export const ipcRenderer = {
  invoke: vi.fn(() => Promise.resolve(undefined)),
  send: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
}

export const contextBridge = {
  exposeInMainWorld: vi.fn(),
}

export const shell = {
  openPath: vi.fn(() => Promise.resolve('')),
  openExternal: vi.fn(() => Promise.resolve()),
  showItemInFolder: vi.fn(),
}

export const webContents = {
  fromId: vi.fn(),
  getAllWebContents: vi.fn(() => []),
}

export const clipboard = {
  readText: vi.fn(() => ''),
  writeText: vi.fn(),
}

export const dialog = {
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
  showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
  showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: undefined })),
}

export const screen = {
  getPrimaryDisplay: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })),
  getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
}

// 未知导出按属性名缓存，保证多次取到同一个 mock 实例
const fallbackCache = new Map<string, (...args: unknown[]) => unknown>()
const fallback = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (!fallbackCache.has(prop)) {
        fallbackCache.set(prop, vi.fn(() => undefined))
      }
      return fallbackCache.get(prop)
    },
  }
)

export const BrowserWindow = fallback.BrowserWindow
export const WebContentsView = fallback.WebContentsView
export const Menu = fallback.Menu
export const MenuItem = fallback.MenuItem
export const nativeImage = fallback.nativeImage
export const session = fallback.session
export const protocol = fallback.protocol
export const globalShortcut = fallback.globalShortcut
export const Notification = fallback.Notification
export const Tray = fallback.Tray
export const nativeTheme = fallback.nativeTheme
export const powerMonitor = fallback.powerMonitor

export default {
  app,
  ipcMain,
  ipcRenderer,
  contextBridge,
  shell,
  webContents,
  clipboard,
  dialog,
  screen,
  BrowserWindow,
  WebContentsView,
  Menu,
  MenuItem,
  nativeImage,
  session,
  protocol,
  globalShortcut,
  Notification,
  Tray,
  nativeTheme,
  powerMonitor,
}
