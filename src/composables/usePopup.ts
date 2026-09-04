export function usePopup() {
  const popupMod = window.bridge.getModules(['popup']).popup

  const show = (options: unknown) => {
    popupMod.show(options)
  }

  const hide = () => {
    popupMod.hide()
  }

  const onAction = (callback: (action: string, context?: any) => void | Promise<void>) => {
    return popupMod.onAction((data: { action: string; context?: any }) => {
      try {
        callback(data.action, data.context)
      } catch (err) {
        console.error('[usePopup] action handler error:', err)
      }
    })
  }

  const onHide = (callback: () => void) => {
    return popupMod.onHide(() => {
      try {
        callback()
      } catch (err) {
        console.error('[usePopup] hide handler error:', err)
      }
    })
  }

  return { show, hide, onAction, onHide }
}