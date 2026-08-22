import type { Rectangle } from 'electron'

export interface PositionOptions {
  preferred: { x: number; y: number }
  size: { width?: number; height?: number }
  itemCount?: number
}

export interface PositionResult {
  x: number
  y: number
  width: number
  height: number
}

export function calculatePopupPosition(
  containerBounds: Rectangle,
  options: PositionOptions
): PositionResult {
  const width = options.size.width || 200
  const itemCount = options.itemCount || 0
  const estimatedHeight = options.size.height || Math.min(itemCount * 32 + 8, 400)

  let x = options.preferred.x
  let y = options.preferred.y

  if (x + width > containerBounds.x + containerBounds.width) {
    x = containerBounds.x + containerBounds.width - width
  }
  if (y + estimatedHeight > containerBounds.y + containerBounds.height) {
    y = containerBounds.y + containerBounds.height - estimatedHeight
  }

  return { x, y, width, height: estimatedHeight }
}
