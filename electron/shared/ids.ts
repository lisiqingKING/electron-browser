/**
 * ID 格式校验（NFR-S4）。
 *
 * 会话 / 笔记 / 目录的 ID 全部由主进程生成，字符集固定。
 * IPC 入口只接受这一套字符，拒绝引号、空格、分号等非预期字符。
 */

// 字母、数字、下划线、连字符；长度上限 64
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value)
}
