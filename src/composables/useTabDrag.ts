import { ref } from 'vue'
import { useEventListener } from '@vueuse/core'

const DRAG_THRESHOLD = 20
const DRAG_TRIGGER_DISTANCE = 36

export function useTabDrag(onDragOut: (tabId: string, screenPos: { x: number; y: number }) => void) {
  const isDragging = ref(false)
  const dragStartPos = ref({ x: 0, y: 0 })
  const dragTabId = ref<string | null>(null)
  const dragTabEl = ref<HTMLElement | null>(null)
  const dragGhost = ref<HTMLElement | null>(null)

  const onMouseDown = (e: MouseEvent, tab: { id?: string }) => {
    if (e.button !== 0) return
    isDragging.value = true
    dragStartPos.value = { x: e.clientX, y: e.clientY }
    dragTabId.value = tab.id || null
    dragTabEl.value = e.currentTarget as HTMLElement
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !dragTabId.value) return

    const dy = e.clientY - dragStartPos.value.y

    if (dragGhost.value) {
      dragGhost.value.style.left = `${e.clientX - 60}px`
      dragGhost.value.style.top = `${e.clientY - 15}px`
    } else if (Math.abs(dy) > DRAG_THRESHOLD && dragTabEl.value) {
      startDragGhost(dragTabEl.value)
    }

    if (dy > DRAG_TRIGGER_DISTANCE && dragTabId.value) {
      onDragOut(dragTabId.value, { x: e.screenX, y: e.screenY })
      cleanupDrag()
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
    if (dragGhost.value) {
      dragGhost.value.remove()
      dragGhost.value = null
    }
  }

  useEventListener(document, 'mousemove', onMouseMove)
  useEventListener(document, 'mouseup', cleanupDrag)

  return { isDragging, onMouseDown }
}
