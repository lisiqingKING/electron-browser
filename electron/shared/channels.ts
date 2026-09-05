/**
 * 主进程 → 渲染进程推送事件 channel 定义
 * 两侧须保持一致：主进程发送和渲染进程订阅须用同一 channel 名
 */

// Tab 事件（主进程主动推送）
export const tabChannels = {
  infoChanged: 'tab:info-changed',
  listChanged: 'tab:list-changed',
  currentChanged: 'tab:current-changed',
  canNavigate: 'tab:can-navigate',
  loading: 'tab:loading',
} as const

// 主进程就绪信号
export const mainChannels = {
  readyForPopup: 'main:ready-for-popup',
} as const
