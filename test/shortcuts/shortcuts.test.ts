/**
 * 快捷方式模块（自定义快捷方式）的回归测试。
 *
 * 覆盖三件容易出错的事：
 *   1. URL 归一化 —— "example.com" 与 "https://example.com/" 必须落到同一个 url，
 *      否则唯一约束拦不住重复添加
 *   2. 名称兜底 —— 名称为空时用 hostname，www. 前缀要去掉
 *   3. 排序 —— 快捷方式区按创建顺序展示，createdAt 相同时必须有稳定的 tiebreaker
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../electron/shared/database', async () => {
  const { createTestDb } = await import('../helpers/testDb')
  const db = createTestDb()
  return {
    getDatabase: () => db,
    initDatabase: () => db,
    closeDatabase: () => {},
  }
})

import '../../electron/modules/shortcuts/shortcutsDb'
import {
  addShortcut,
  getAllShortcuts,
  normalizeShortcutUrl,
  removeShortcut,
  resolveShortcutName,
  setShortcutIcon,
} from '../../electron/modules/shortcuts/manager'
import { getDatabase } from '../../electron/shared/database'

const db = getDatabase()

beforeEach(() => {
  db.exec('DELETE FROM shortcuts')
})

describe('URL 归一化', () => {
  it('缺失协议时补 https', () => {
    expect(normalizeShortcutUrl('example.com')).toBe('https://example.com')
  })

  it('去掉根路径末尾斜杠，使两种写法落到同一个 url', () => {
    expect(normalizeShortcutUrl('https://example.com/')).toBe('https://example.com')
    expect(normalizeShortcutUrl('https://example.com')).toBe('https://example.com')
  })

  it('保留路径与查询串', () => {
    expect(normalizeShortcutUrl('https://example.com/a/b')).toBe('https://example.com/a/b')
    expect(normalizeShortcutUrl('https://example.com/?q=1')).toBe('https://example.com/?q=1')
  })

  it('保留 http 协议', () => {
    expect(normalizeShortcutUrl('http://example.com')).toBe('http://example.com')
  })

  it('拒绝空网址', () => {
    expect(() => normalizeShortcutUrl('   ')).toThrow('网址不能为空')
  })

  it('拒绝非 http/https 协议', () => {
    expect(() => normalizeShortcutUrl('file:///etc/passwd')).toThrow('仅支持 http/https 网址')
    expect(() => normalizeShortcutUrl('ftp://example.com')).toThrow('仅支持 http/https 网址')
  })

  it('拒绝超长网址', () => {
    expect(() => normalizeShortcutUrl(`https://example.com/${'a'.repeat(2048)}`)).toThrow('网址不能超过')
  })

  it('拒绝没有后缀的域名 —— new URL 接受但根本打不开', () => {
    expect(() => normalizeShortcutUrl('abc')).toThrow('网址格式不合法')
    expect(() => normalizeShortcutUrl('example')).toThrow('网址格式不合法')
  })

  it('拒绝非法域名结构', () => {
    expect(() => normalizeShortcutUrl('example..com')).toThrow('网址格式不合法')
    expect(() => normalizeShortcutUrl('a'.repeat(64) + '.com')).toThrow('网址格式不合法')
    // 总长超 253
    const long = Array.from({ length: 5 }, () => 'a'.repeat(50)).join('.') + '.com'
    expect(() => normalizeShortcutUrl(long)).toThrow('网址格式不合法')
  })

  it('接受 localhost 与 IP', () => {
    expect(normalizeShortcutUrl('localhost:5273')).toBe('https://localhost:5273')
    expect(normalizeShortcutUrl('127.0.0.1')).toBe('https://127.0.0.1')
    expect(() => normalizeShortcutUrl('999.1.1.1')).toThrow('网址格式不合法')
  })

  it('接受国际化域名（punycode）', () => {
    expect(normalizeShortcutUrl('http://例え.テスト')).toBe('http://xn--r8jz45g.xn--zckzah')
  })
})

describe('名称兜底', () => {
  it('名称为空时用 hostname', () => {
    expect(resolveShortcutName('', 'https://example.com')).toBe('example.com')
  })

  it('去掉 www. 前缀', () => {
    expect(resolveShortcutName(undefined, 'https://www.example.com')).toBe('example.com')
  })

  it('显式名称优先，并 trim', () => {
    expect(resolveShortcutName('  我的站点 ', 'https://example.com')).toBe('我的站点')
  })

  it('拒绝超长名称', () => {
    expect(() => resolveShortcutName('a'.repeat(33), 'https://example.com')).toThrow('名称不能超过')
  })

  it('拒绝含控制字符的名称', () => {
    expect(() => resolveShortcutName('a\nb', 'https://example.com')).toThrow('控制字符')
    expect(() => resolveShortcutName('a\tb', 'https://example.com')).toThrow('控制字符')
  })

  it('接受中文、emoji 等正常字符', () => {
    expect(resolveShortcutName('我的站点', 'https://example.com')).toBe('我的站点')
    expect(resolveShortcutName('🚀 启动', 'https://example.com')).toBe('🚀 启动')
  })
})

describe('增删查', () => {
  it('添加后出现在列表里，初始无图标', () => {
    const shortcut = addShortcut({ name: '示例', url: 'example.com' })
    expect(shortcut.url).toBe('https://example.com')
    expect(shortcut.icon).toBeNull()

    const list = getAllShortcuts()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('示例')
  })

  it('拒绝重复 url —— 归一化后相同也算重复', () => {
    addShortcut({ name: 'A', url: 'example.com' })
    expect(() => addShortcut({ name: 'B', url: 'https://example.com/' })).toThrow('该快捷方式已存在')
  })

  it('列表按创建顺序排列', () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2000).mockReturnValueOnce(3000)

    addShortcut({ name: '第一', url: 'a.com' })
    addShortcut({ name: '第二', url: 'b.com' })
    addShortcut({ name: '第三', url: 'c.com' })

    expect(getAllShortcuts().map((s) => s.name)).toEqual(['第一', '第二', '第三'])
    nowSpy.mockRestore()
  })

  it('删除不存在的 id 返回 false', () => {
    expect(removeShortcut('short-does-not-exist')).toBe(false)
  })

  it('删除后从列表消失', () => {
    const shortcut = addShortcut({ name: '示例', url: 'example.com' })
    expect(removeShortcut(shortcut.id)).toBe(true)
    expect(getAllShortcuts()).toHaveLength(0)
  })

  it('回填图标', () => {
    const shortcut = addShortcut({ name: '示例', url: 'example.com' })
    setShortcutIcon(shortcut.id, 'data:image/png;base64,AAA')
    expect(getAllShortcuts()[0].icon).toBe('data:image/png;base64,AAA')
  })
})
