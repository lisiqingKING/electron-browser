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
    window.ipcRenderer.send('popup:show', options)
  }

  const hide = () => {
    window.ipcRenderer.send('popup:hide')
  }

  const onAction = (callback: (action: string, context?: any) => void | Promise<void>) => {
    const handler = async (_event: any, data: { action: string; context?: any }) => {
      try {
        await callback(data.action, data.context)
      } catch (err) {
        console.error('[usePopup] action handler error:', err)
      }
    }

    window.ipcRenderer.on('popup:action', handler)

    return () => {
      window.ipcRenderer.off('popup:action', handler)
    }
  }

  return { show, hide, onAction }
}
