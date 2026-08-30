import { ref } from 'vue'
import { useEventListener, useThrottleFn } from '@vueuse/core'

const DRAG_THRESHOLD = 20
const DRAG_TRIGGER_DISTANCE = 36
const THROTTLE_MS = 16

const updatePosition = useThrottleFn((winId: number, pos: { x: number; y: number }) => {
  window.ipcRenderer.invoke('window:update-position', winId, pos)
}, THROTTLE_MS)

export function useTabDrag(onDragOut: (tabId: string, screenPos: { x: number; y: number }) => void) {
  const isDragging = ref(false)
  const dragStartPos = ref({ x: 0, y: 0 })
  const dragTabId = ref<string | null>(null)
  const dragTabEl = ref<HTMLElement | null>(null)
  const dragGhost = ref<HTMLElement | null>(null)
  const adoptedWindowId = ref<number | null>(null)

  const onMouseDown = (e: MouseEvent, tab: { id?: string; isHome?: boolean }, currentTabId: string | null) => {
    if (e.button !== 0) return
    if (tab.isHome || tab.id !== currentTabId) return
    isDragging.value = true
    dragStartPos.value = { x: e.clientX, y: e.clientY }
    dragTabId.value = tab.id || null
    dragTabEl.value = e.currentTarget as HTMLElement
  }

  const isAdopting = ref(false)

  const onMouseMove = async (e: MouseEvent) => {
    if (!isDragging.value || !dragTabId.value) return

    const dy = e.clientY - dragStartPos.value.y

    if (dragGhost.value) {
      dragGhost.value.style.left = `${e.clientX - 60}px`
      dragGhost.value.style.top = `${e.clientY - 15}px`
    } else if (Math.abs(dy) > DRAG_THRESHOLD && dragTabEl.value) {
      startDragGhost(dragTabEl.value)
    }

    if (dy > DRAG_TRIGGER_DISTANCE && dragTabId.value) {
      if (adoptedWindowId.value === null && !isAdopting.value) {
        // 首次超过阈值，创建新窗口
        isAdopting.value = true
        const pos = { x: e.screenX - dragStartPos.value.x, y: e.screenY - dragStartPos.value.y - 30 }
        const winId = await onDragOut(dragTabId.value, pos)
        adoptedWindowId.value = winId ?? null
        isAdopting.value = false
      } else if (typeof adoptedWindowId.value === 'number') {
        updatePosition(adoptedWindowId.value, {
          x: e.screenX - dragStartPos.value.x,
          y: e.screenY - dragStartPos.value.y - 30,
        })
      }
    }
  }

  const startDragGhost = (tabEl: HTMLElement) => {
    if (dragGhost.value) dragGhost.value.remove()
    const ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.textContent = tabEl.querySelector('.tab-title')?.textContent || ''
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      background: var(--tabbar-active-bg);
      color: var(--tabbar-text-active);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      opacity: 0.9;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `
    document.body.appendChild(ghost)
    dragGhost.value = ghost
  }

  const cleanupDrag = () => {
    isDragging.value = false
    dragStartPos.value = { x: 0, y: 0 }
    dragTabId.value = null
    dragTabEl.value = null
    adoptedWindowId.value = null
    if (dragGhost.value) {
      dragGhost.value.remove()
      dragGhost.value = null
    }
  }

  useEventListener(document, 'mousemove', onMouseMove)
  useEventListener(document, 'mouseup', cleanupDrag)

  return { isDragging, onMouseDown }
}
