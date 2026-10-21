import { vi } from 'vitest'

// electron 由 vitest.config.ts 的 resolve.alias 替换为 test/mocks/electron.ts，
// 桩里所有可断言的 API 都是 vi.fn()，这里不再重复 mock。

// logger 依赖 electron-log 的文件输出，测试里换成空实现
vi.mock('../electron/shared/logger', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
  }
  return {
    LOG_MODULES: ['main', 'render', 'network', 'ipc', 'sql'],
    mainLogger: logger,
    ipcLogger: logger,
    sqlLogger: logger,
    renderLogger: logger,
    networkLogger: logger,
    initLoggers: vi.fn(),
    log: logger,
  }
})
