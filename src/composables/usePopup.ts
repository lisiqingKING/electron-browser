export interface MenuItem {
  label?: string
  action?: string
  icon?: string
  favicon?: string | null
  disabled?: boolean
  separator?: boolean
  children?: MenuItem[]
}

interface PopupOptions {
  x: number
  y: number
  type: 'menu' | string
  data: any
  width?: number
  height?: number
  context?: any
}

export function usePopup() {
  const showMenu = (event: MouseEvent, items: MenuItem[], context?: any) => {
    event.preventDefault()

    const options: PopupOptions = {
      x: event.screenX,
      y: event.screenY,
      type: 'menu',
      data: { items },
      context
    }

    window.ipcRenderer.send('popup:show', options)
  }

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

  return { show, showMenu, hide, onAction }
}
