/**
 * 内存监控配置
 * 开发/生产两套配置，统一管理
 */

// 开发环境配置（宽松）
const devConfig = {
  snapshotInterval: 60_000,         // 60s 采集一次
  maxSnapshots: 100,                // 内存保留最近 100 个快照

  // 泄漏检测
  leakThresholdWarning: 1,          // 1 MB/min → 轻微泄漏
  leakThresholdCritical: 5,         // 5 MB/min → 严重泄漏
  minSamplesForLeak: 10,            // 至少 10 个样本才做泄漏检测

  // 主进程告警
  alertMainHeapMB: 500,
  alertMainRssMB: 800,
  alertTabHeapMB: 200,

  // 触发 Tab 深采集的增量阈值
  tabCollectHeapDeltaMB: 50,
  tabCollectRssDeltaMB: 100,

  // 日志
  maxLogFiles: 10,
  maxLogFileSizeMB: 10,
}

// 生产环境配置（严格）
const prodConfig = {
  ...devConfig,
  snapshotInterval: 60_000,
  alertMainHeapMB: 400,
  alertMainRssMB: 700,
  alertTabHeapMB: 150,
  tabCollectHeapDeltaMB: 30,
  tabCollectRssDeltaMB: 80,
}

// 导出当前环境配置
export const memoryConfig = process.env.NODE_ENV === 'production' ? prodConfig : devConfig

export type MemoryConfig = typeof devConfig
