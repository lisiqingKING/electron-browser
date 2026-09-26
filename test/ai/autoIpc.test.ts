import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerModuleHandlers, createProxy } from '../../electron/shared/autoIpc'

const { mockIpcMain, mockIpcRenderer } = vi.hoisted(() => {
  return {
    mockIpcMain: {
      handle: vi.fn(),
    },
    mockIpcRenderer: {
      invoke: vi.fn(),
    },
  }
})

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
}))

describe('autoIpc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registerModuleHandlers', () => {
    it('should register each method as ipcMain.handle', () => {
      const module = {
        get: () => 'result',
        set: (value: string) => { console.log(value) },
      }

      registerModuleHandlers('test', module)

      expect(mockIpcMain.handle).toHaveBeenCalledTimes(2)
      expect(mockIpcMain.handle).toHaveBeenCalledWith('test:get', expect.any(Function))
      expect(mockIpcMain.handle).toHaveBeenCalledWith('test:set', expect.any(Function))
    })

    it('should use moduleName:method as channel name', () => {
      const module = {
        readText: () => 'clipboard text',
      }

      registerModuleHandlers('clipboard', module)

      expect(mockIpcMain.handle).toHaveBeenCalledWith('clipboard:readText', expect.any(Function))
    })

    it('should not register non-function properties', () => {
      const module = {
        get: () => 'result',
        VERSION: '1.0.0',
      }

      registerModuleHandlers('test', module)

      expect(mockIpcMain.handle).toHaveBeenCalledTimes(1)
    })
  })

  describe('createProxy', () => {
    it('should create proxy with invoke calls', () => {
      const module = {
        get: () => 'result',
      }

      const proxy = createProxy('test', module, mockIpcRenderer as any)

      proxy.get()
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('test:get')
    })

    it('should pass arguments to invoke', () => {
      const module = {
        set: (key: string, value: string) => {},
      }

      const proxy = createProxy('settings', module, mockIpcRenderer as any)

      proxy.set('theme', 'dark')
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('settings:set', 'theme', 'dark')
    })

    it('should generate correct channel name', () => {
      const module = {
        readText: () => 'text',
        writeText: (text: string) => {},
      }

      const proxy = createProxy('clipboard', module, mockIpcRenderer as any)

      proxy.readText()
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clipboard:readText')

      proxy.writeText('hello')
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clipboard:writeText', 'hello')
    })

    it('should not include non-function properties in proxy', () => {
      const module = {
        get: () => 'result',
        VERSION: '1.0.0',
      }

      const proxy = createProxy('test', module, mockIpcRenderer as any)

      expect(typeof proxy.get).toBe('function')
      expect(proxy.VERSION).toBeUndefined()
    })
  })
})
