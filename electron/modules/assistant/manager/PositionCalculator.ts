import type { Rectangle } from 'electron'

export interface PositionResult {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 520

export function calculateAssistantPosition(
  screenBounds: Rectangle,
  preferred: { x: number; y: number }
): PositionResult {
  let x = preferred.x
  let y = preferred.y
  const width = DEFAULT_WIDTH
  const height = DEFAULT_HEIGHT

  // 如果右边超出屏幕，左移
  if (x + width > screenBounds.x + screenBounds.width) {
    x = screenBounds.x + screenBounds.width - width
  }
  // 如果下边超出屏幕，上移
  if (y + height > screenBounds.y + screenBounds.height) {
    y = screenBounds.y + screenBounds.height - height
  }

  // 左边界也不能超
  if (x < screenBounds.x) {
    x = screenBounds.x
  }
  // 上边界也不能超
  if (y < screenBounds.y) {
    y = screenBounds.y
  }

  return { x, y, width, height }
}
