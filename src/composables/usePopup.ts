interface PopupOptions {
  x: number
  y: number
  component: string
  props?: Record<string, any>
  width?: number
  height?: number
  context?: any
}

export function usePopup() {
  const show = (options: PopupOptions) => {
    window.bridge.send('popup:show', options)
  }

  const hide = () => {
    window.bridge.send('popup:hide')
  }

  const onAction = (callback: (action: string, context?: any) => void | Promise<void>) => {
    const handler = (data: { action: string; context?: any }) => {
      try {
        callback(data.action, data.context)
      } catch (err) {
        console.error('[usePopup] action handler error:', err)
      }
    }

    window.bridge.on('popup:action', handler)

    return () => {
      window.bridge.off('popup:action', handler)
    }
  }

  return { show, hide, onAction }
}
