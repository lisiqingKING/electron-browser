// workspace 模块 - 工作区状态（每个主会话一份）
import { ipcRenderer } from 'electron'

export const workspaceChannels = {
  getState: 'workspace:getState',
  setActive: 'workspace:setActive',
  deleteState: 'workspace:deleteState',
} as const

export function createWorkspaceProxy() {
  const proxy: Record<string, (...args: unknown[]) => unknown> = {}
  for (const [method, channel] of Object.entries(workspaceChannels)) {
    proxy[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  }
  return proxy
}

export type WorkspaceModule = ReturnType<typeof createWorkspaceProxy>
