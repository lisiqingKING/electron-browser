// downloads 模块的 channel 常量. 零依赖, 可被 preload 安全 import.
export const downloadsChannels = {
  list: 'downloads:list',
  add: 'downloads:add',
  pause: 'downloads:pause',
  resume: 'downloads:resume',
  cancel: 'downloads:cancel',
  remove: 'downloads:remove',
  reveal: 'downloads:reveal',
  openFile: 'downloads:open-file',
  clear: 'downloads:clear',
  directDownloadUrl: 'downloads:direct-download-url',
  getSaveDir: 'downloads:get-save-dir',
  selectSaveDir: 'downloads:select-save-dir',
  event: 'downloads:event',
} as const

export const blobChannels = {
  write: 'blob-download:write',
  done: 'blob-download:done',
  error: 'blob-download:error',
} as const
