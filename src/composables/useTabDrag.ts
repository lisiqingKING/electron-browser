import { ref } from 'vue'
import { useEventListener, useThrottleFn } from '@vueuse/core'

const DRAG_TRIGGER_DISTANCE = 36
const THROTTLE_MS = 16

const updatePosition = useThrottleFn((winId: number, pos: { x: number; y: number }) => {
  window.bridge.getModules(['window']).window.updatePosition(winId, pos)
}, THROTTLE_MS)

export function useTabDrag(onDragOut: (tabId: string, screenPos: { x: number; y: number }) => void) {
  const isDragging = ref(false)
  const dragStartPos = ref({ x: 0, y: 0 })
  const dragTabId = ref<string | null>(null)
  const dragTabEl = ref<HTMLElement | null>(null)
  const adoptedWindowId = ref<number | null>(null)
  const windowInitMouse = ref({ x: 0, y: 0 })
  const windowInitPos = ref({ x: 0, y: 0 })
  const dragInitMouse = ref({ x: 0, y: 0 })

  const onMouseDown = (e: MouseEvent, tab: { id?: string; isHome?: boolean }, tabId: string | null) => {
    if (e.button !== 0) return
    if (tab.isHome || tab.id !== tabId) return
    isDragging.value = true
    const tabRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragStartPos.value = { x: e.clientX - tabRect.left, y: e.clientY - tabRect.top }
    dragInitMouse.value = { x: e.clientX, y: e.clientY }
    dragTabId.value = tab.id || null
    dragTabEl.value = e.currentTarget as HTMLElement
  }

  const onMouseMove = async (e: MouseEvent) => {
    if (!isDragging.value || !dragTabId.value) return

    const dy = e.clientY - dragInitMouse.value.y

    if (dy > DRAG_TRIGGER_DISTANCE && dragTabId.value) {
      if (adoptedWindowId.value === null) {
        // 首次超过阈值，创建新窗口
        const pos = {
          x: e.screenX - (dragStartPos.value.x + 250),
          y: e.screenY - e.clientY + 30,
        }
        windowInitMouse.value = { x: e.screenX, y: e.screenY }
        windowInitPos.value = { ...pos }
        const winId = await onDragOut(dragTabId.value, pos)
        adoptedWindowId.value = winId ?? null
      } else if (typeof adoptedWindowId.value === 'number') {
        // 拖拽更新：窗口当前位置 + (当前鼠标 - 窗口初始化时鼠标)
        updatePosition(adoptedWindowId.value, {
          x: windowInitPos.value.x + (e.screenX - windowInitMouse.value.x),
          y: windowInitPos.value.y + (e.screenY - windowInitMouse.value.y),
        })
      }
    }
  }

  const cleanupDrag = () => {
    isDragging.value = false
    dragStartPos.value = { x: 0, y: 0 }
    dragInitMouse.value = { x: 0, y: 0 }
    dragTabId.value = null
    dragTabEl.value = null
    adoptedWindowId.value = null
  }

  useEventListener(document, 'mousemove', onMouseMove)
  useEventListener(document, 'mouseup', cleanupDrag)

  return { isDragging, onMouseDown }
}
