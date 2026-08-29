/// <reference types="vite/client" />

// Vite ?raw import 类型声明
declare module '*.svg?raw' {
  const content: string
  export default content
}

interface Window {
  __APP_ROUTE__?: string
}
