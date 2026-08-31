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
  }
}
