import {
  getAllFavorites as getAllFromDb,
  addFavorite as addToDb,
  removeFavorite as removeFromDb,
  type FavoriteItem
} from '../favoritesDb'
import { getCachedIcon, getIconFromDb } from '../../icons/manager'

let favoritesCache: Set<string> | null = null

export function syncFromDb(): void {
  favoritesCache = new Set()
  const records = getAllFromDb()
  for (const item of records) {
    favoritesCache.add(item.url)
  }
}

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

export function checkFavorite(url: string): boolean {
  if (favoritesCache === null) {
    syncFromDb()
  }
  return favoritesCache!.has(url)
}

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

export function removeFavorite(url: string): void {
  if (favoritesCache === null) {
    syncFromDb()
  }
  removeFromDb(url)
  favoritesCache!.delete(url)
}
