import { ipcRenderer } from 'electron'
import { popupChannels } from './channels'

export function createPopupProxy() {
  const onRenderFn = new Set<Function>()
  const onHideFn = new Set<Function>()
  const onActionFn = new Set<Function>()
  let renderListenerRegistered = false
  let hideListenerRegistered = false
  let actionListenerRegistered = false

  function handleRender(_event: Electron.IpcRendererEvent, ...args: unknown[]) {
    onRenderFn.forEach(fn => fn(...args))
  }

  function handleHide(_event: Electron.IpcRendererEvent, ...args: unknown[]) {
    onHideFn.forEach(fn => fn(...args))
  }

  function handleAction(_event: Electron.IpcRendererEvent, ...args: unknown[]) {
    onActionFn.forEach(fn => fn(...args))
  }

  function ensureRenderListener() {
    if (!renderListenerRegistered) {
      ipcRenderer.on(popupChannels.render, handleRender)
      renderListenerRegistered = true
    }
  }

  function ensureHideListener() {
    if (!hideListenerRegistered) {
      ipcRenderer.on(popupChannels.hide, handleHide)
      hideListenerRegistered = true
    }
  }

  function ensureActionListener() {
    if (!actionListenerRegistered) {
      ipcRenderer.on(popupChannels.action, handleAction)
      actionListenerRegistered = true
    }
  }

  function cleanupRenderIfEmpty() {
    if (onRenderFn.size === 0) {
      ipcRenderer.removeListener(popupChannels.render, handleRender)
      renderListenerRegistered = false
    }
  }

  function cleanupHideIfEmpty() {
    if (onHideFn.size === 0) {
      ipcRenderer.removeListener(popupChannels.hide, handleHide)
      hideListenerRegistered = false
    }
  }

  function cleanupActionIfEmpty() {
    if (onActionFn.size === 0) {
      ipcRenderer.removeListener(popupChannels.action, handleAction)
      actionListenerRegistered = false
    }
  }

  return {
    show: (options: unknown) => ipcRenderer.send(popupChannels.show, options),
    hide: () => ipcRenderer.send(popupChannels.hide),
    action: (data: unknown) => ipcRenderer.send(popupChannels.action, data),

    onRender: (fn: Function) => {
      ensureRenderListener()
      onRenderFn.add(fn)
      return () => { onRenderFn.delete(fn); cleanupRenderIfEmpty() }
    },

    onHide: (fn: Function) => {
      ensureHideListener()
      onHideFn.add(fn)
      return () => { onHideFn.delete(fn); cleanupHideIfEmpty() }
    },

    onAction: (fn: Function) => {
      ensureActionListener()
      onActionFn.add(fn)
      return () => { onActionFn.delete(fn); cleanupActionIfEmpty() }
    },
  }
}

export type PopupModule = ReturnType<typeof createPopupProxy>
