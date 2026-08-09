import {
  getAllFavorites as getAllFromDb,
  addFavorite as addToDb,
  removeFavorite as removeFromDb,
  type FavoriteItem
} from './favoritesDb'
import { getCachedIcon, getIconFromDb } from '../icons/iconsManager'

// ============ 收藏 Manager 层 ============
// 门面层，管理内存缓存，调用 DAO 层

// 内存缓存: Set<string>（URL 为 key）
let favoritesCache: Set<string> | null = null

// 同步数据库到内存
export function syncFromDb(): void {
  favoritesCache = new Set()
  const records = getAllFromDb()
  for (const item of records) {
    favoritesCache.add(item.url)
  }
}

// 获取所有收藏
export function getAllFavorites(): FavoriteItem[] {
  return getAllFromDb().map(item => ({
    ...item,
    favicon: resolveFavicon(item.url, item.favicon)
  }))
}

function resolveFavicon(pageUrl: string, originalFavicon?: string): string | undefined {
  const cached = getCachedIcon(pageUrl)
  if (cached) return cached
  const fromDb = getIconFromDb(pageUrl)
  if (fromDb) return fromDb
  return originalFavicon
}

// 检查是否已收藏
export function checkFavorite(url: string): boolean {
  if (favoritesCache === null) {
    syncFromDb()
  }
  return favoritesCache!.has(url)
}

// 切换收藏状态
export function toggleFavorite(url: string, title: string, favicon?: string): boolean {
  if (favoritesCache === null) {
    syncFromDb()
  }
  if (favoritesCache!.has(url)) {
    removeFromDb(url)
    favoritesCache!.delete(url)
    return false
  } else {
    addToDb(url, title, favicon)
    favoritesCache!.add(url)
    return true
  }
}

// 删除收藏（通过 url）
export function removeFavorite(url: string): void {
  if (favoritesCache === null) {
    syncFromDb()
  }
  removeFromDb(url)
  favoritesCache!.delete(url)
}
