/**
 * 内部子应用页面路由 → SVG path 映射
 * Material Design Icons (https://fonts.google.com/icons)
 *
 * 图标来源: src/assets/icons/*.svg (与子项目 app/src/assets/icons/ 保持一致)
 * 不要在此文件中硬编码 path 数据，如有变更请修改对应的 SVG 文件
 */

import aiSvg from '../assets/icons/ai.svg?raw'
import historySvg from '../assets/icons/history.svg?raw'
import downloadsSvg from '../assets/icons/downloads.svg?raw'
import logsSvg from '../assets/icons/logs.svg?raw'

/**
 * 从 SVG 字符串中提取 path 元素的 d 属性值
 */
function extractPathD(svgString: string): string {
  // 匹配 <path ... d="..." 中的 d 值
  const match = svgString.match(/<path[^>]*\sd="([^"]*)"/)
  return match ? match[1] : ''
}

export const TAB_ICON_MAP: Record<string, string> = {
  // 收藏夹 - 星星
  'favorites': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  // 链接 - 外部页面图标
  'link': 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  // 首页 - 房子
  '': 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  'default': 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  // 新标签页 - 加号
  'newtab': 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  // AI 助手 - 从 ai.svg 读取
  'ai': extractPathD(aiSvg),
  // AI 保存记录 - 文档
  'ai-saves': 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  // 历史记录 - 从 history.svg 读取
  'history': extractPathD(historySvg),
  // 下载管理 - 从 downloads.svg 读取
  'downloads': extractPathD(downloadsSvg),
  // 日志查看 - 从 logs.svg 读取
  'logs': extractPathD(logsSvg),
  // 设置 - 齿轮
  'settings': 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  // 错误页 - 三角警告
  'error': 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
}

/**
 * 根据路由返回 SVG path，无匹配返回 null
 */
export function getTabIcon(route: string | null): string | null {
  if (!route) return null
  return TAB_ICON_MAP[route] ?? null
}

/**
 * 从 URL 提取子应用路由，外部 URL 返回 null
 * 支持: lsqapp://internal-app/history, http://localhost:5273/#/history
 */
export function getRouteFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    // lsqapp 协议: lsqapp://internal-app/history → history
    if (parsed.protocol === 'lsqapp:') {
      // pathname 是 '/history'，去掉前导斜杠
      const route = parsed.pathname.replace(/^\//, '')
      return route || null
    }
    // localhost hash 路由: http://localhost:5273/#/history → history
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      if (parsed.hash) {
        return parsed.hash.replace('#/', '') || null
      }
      return null
    }
    // 外部 URL
    return null
  } catch {
    return null
  }
}

/**
 * 从 URL 直接获取内部页面 SVG path，外部 URL 返回 null
 * 组合了 getRouteFromUrl + getTabIcon，避免模板中重复调用
 */
export function getInternalIconFromUrl(url: string): string | null {
  return getTabIcon(getRouteFromUrl(url))
}
