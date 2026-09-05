// popup 模块 - 定义 IPC channel 和方法映射
import { ipcRenderer } from 'electron'

export const popupChannels = {
  show: 'popup:show',
  hide: 'popup:hide',
  action: 'popup:action',
  render: 'popup:render',
} as const

export function createPopupProxy() {
  const onRenderFn = new Set<(windowId: number) => void>()
  const onHideFn = new Set<(windowId: number) => void>()
  const onActionFn = new Set<(data: unknown) => void>()
  let renderRegistered = false
  let hideRegistered = false
  let actionRegistered = false

  function handleRender(_event: Electron.IpcRendererEvent, windowId: number) {
    onRenderFn.forEach(fn => fn(windowId))
  }

  function handleHide(_event: Electron.IpcRendererEvent, windowId: number) {
    onHideFn.forEach(fn => fn(windowId))
  }

  function handleAction(_event: Electron.IpcRendererEvent, data: unknown) {
    onActionFn.forEach(fn => fn(data))
  }

  function ensureRenderListener() {
    if (!renderRegistered) {
      ipcRenderer.on(popupChannels.render, handleRender)
      renderRegistered = true
    }
  }

  function ensureHideListener() {
    if (!hideRegistered) {
      ipcRenderer.on(popupChannels.hide, handleHide)
      hideRegistered = true
    }
  }

  function ensureActionListener() {
    if (!actionRegistered) {
      ipcRenderer.on(popupChannels.action, handleAction)
      actionRegistered = true
    }
  }

  function cleanupRenderIfEmpty() {
    if (onRenderFn.size === 0) {
      ipcRenderer.removeListener(popupChannels.render, handleRender)
      renderRegistered = false
    }
  }

  function cleanupHideIfEmpty() {
    if (onHideFn.size === 0) {
      ipcRenderer.removeListener(popupChannels.hide, handleHide)
      hideRegistered = false
    }
  }

  function cleanupActionIfEmpty() {
    if (onActionFn.size === 0) {
      ipcRenderer.removeListener(popupChannels.action, handleAction)
      actionRegistered = false
    }
  }

  return {
    show: (options: unknown) => ipcRenderer.send(popupChannels.show, options),
    hide: () => ipcRenderer.send(popupChannels.hide),
    action: (data: unknown) => ipcRenderer.send(popupChannels.action, data),
    onRender(fn: (windowId: number) => void) {
      ensureRenderListener()
      onRenderFn.add(fn)
      return () => { onRenderFn.delete(fn); cleanupRenderIfEmpty() }
    },
    onHide(fn: (windowId: number) => void) {
      ensureHideListener()
      onHideFn.add(fn)
      return () => { onHideFn.delete(fn); cleanupHideIfEmpty() }
    },
    onAction(fn: (data: unknown) => void) {
      ensureActionListener()
      onActionFn.add(fn)
      return () => { onActionFn.delete(fn); cleanupActionIfEmpty() }
    },
  }
}

export type PopupModule = ReturnType<typeof createPopupProxy>
