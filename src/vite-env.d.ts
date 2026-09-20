/// <reference types="vite/client" />

// Vite ?raw import 类型声明
declare module '*.svg?raw' {
  const content: string
  export default content
}

interface Window {
  __APP_ROUTE__?: string
  bridge: {
    windowId: number | null
    getModules(moduleNames?: string[]): Record<string, Record<string, Function>>
    getModuleNames(): string[]
    on(channel: string, fn: Function): void
    off(channel: string, fn: Function): void
    send(channel: string, ...args: unknown[]): void
    // channel 常量，从 preload 注入
    channels: {
      tabs: Record<string, string>
      window: Record<string, string>
      clipboard: Record<string, string>
      history: Record<string, string>
      ai: Record<string, string>
      downloads: Record<string, string>
      settings: Record<string, string>
      favorites: Record<string, string>
      popup: Record<string, string>
      wallpaper: Record<string, string>
      tab: Record<string, string>
      main: Record<string, string>
    }
  }
}
