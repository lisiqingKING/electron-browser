// downloads 模块的 channel 常量. 零依赖, 可被 preload 安全 import.
export const downloadsChannels = {
  list: 'downloads:list',
  add: 'downloads:add',
  pause: 'downloads:pause',
  resume: 'downloads:resume',
  cancel: 'downloads:cancel',
  remove: 'downloads:remove',
  reveal: 'downloads:reveal',
  clear: 'downloads:clear',
  event: 'downloads:event',
  listChanged: 'downloads:list-changed',
} as const
