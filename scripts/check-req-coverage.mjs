#!/usr/bin/env node
/**
 * 需求覆盖校验：需求文档 ↔ 用例文档 ↔ 测试代码 三方对照。
 *
 * 独立的需求 ID 存两份（需求文档 + 用例文档）必然漂移，这���脚本就是防漂移的机制：
 *   1. 需求文档里的每个 FR/NFR/FLOW，是否都在用例文档的总览表里（漏登记 = 漏覆盖）
 *   2. 用例文档里的每个 ID，是否都真实存在于需求文档（写了不存在的需求 = 幻觉）
 *   3. 用例文档里引用的验证位置，文件是否还在、用例名是否还在（测试改名/删除 = 引用失效）
 *   4. 标了 ✅ 的需求，是否真的挂了至少一条自动化验证位置（标绿但没验证 = 自欺欺人）
 *
 * 用法：
 *   node scripts/check-req-coverage.mjs [--app <子项目路径>] [--spec <需求文档>] [--cases <用例文档>]
 *
 * 退出码：0 = 结构一致（可能仍有 ⚠️/❌ 的已知缺口，那属于用例文档里登记的事实）；
 *         1 = 存在结构性问题（漏登记 / 幻觉 / 引用失效 / 标绿无验证）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
function argValue(flag, fallback) {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const appRoot = path.resolve(repoRoot, argValue('--app', path.join(repoRoot, '..', 'app')))
const specPath = path.resolve(repoRoot, argValue('--spec', 'docs/ASSISTANT_PANEL.md'))
const casesPath = path.resolve(repoRoot, argValue('--cases', 'docs/AI_ASSISTANT_CASES.md'))

const REQ_PATTERN = /(?:^|\s)((?:FR|NFR)-[A-Z0-9]+(?:\.[0-9]+)?|FLOW-[0-9]+)/g
const ROW_PATTERN = /^\|\s*((?:FR|NFR)-[A-Z0-9]+(?:\.[0-9]+)?|FLOW-[0-9]+)\s*\|(.*)\|\s*$/
const STATUS_MARKERS = ['✅', '🔸', '⚠️', '❌']

/**
 * 可判定的需求条目。FR-1 ~ FR-7 是章节分组号（FR-1.1 之类才是条目），
 * 不要求在用例文档里单独登记，但允许作为分组行出现。
 */
function isLeafId(id) {
  return /^FR-[0-9]+\.[0-9]+$/.test(id) || /^NFR-[A-Z][0-9]+$/.test(id) || /^FLOW-[0-9]+$/.test(id)
}

function readFileOrExit(file) {
  if (!fs.existsSync(file)) {
    console.error(`找不到文件：${file}`)
    process.exit(1)
  }
  return fs.readFileSync(file, 'utf8')
}

/** 需求文档：抽出所有需求 ID（FR / NFR / FLOW） */
function parseSpecIds(text) {
  const ids = new Set()
  for (const match of text.matchAll(REQ_PATTERN)) ids.add(match[1])
  return ids
}

/**
 * 用例文档总览表：每行第一格是需求 ID，最后一格是状态。
 * 行格式：`| ID | 期望 | 验证方式 | 验证位置 | 状态 |`
 * 只有最后一格带状态标记（✅/🔸/⚠️/❌）的行才算用例行 ——
 * 否则文档里其他以需求 ID 开头的表格会被误当成用例行。
 */
function parseCaseRows(text) {
  const rows = []
  for (const line of text.split('\n')) {
    const match = line.match(ROW_PATTERN)
    if (!match) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 4) continue
    const status = cells[cells.length - 1] ?? ''
    if (!STATUS_MARKERS.some((m) => status.includes(m))) continue
    rows.push({
      id: match[1],
      expect: cells[1] ?? '',
      way: cells[2] ?? '',
      refs: cells[3] ?? '',
      status,
      line: line,
    })
  }
  return rows
}

/**
 * 验证位置单元格：`仓库:相对路径 ›「用例名」`，多条用 `；` 分隔。
 * 仓库前缀：容器（容器仓库根）/ app（子项目根）。
 */
function parseRefs(cell) {
  const refs = []
  for (const code of cell.matchAll(/`([^`]+)`/g)) {
    const raw = code[1]
    const [location, name] = raw.split(' ›').map((s) => s.trim())
    const [repo, filePath] = location.split(':')
    refs.push({
      repo,
      filePath: filePath ?? '',
      name: name?.replace(/^「|」$/g, '') ?? '',
      raw,
    })
  }
  return refs
}

function repoRootOf(repo) {
  if (repo === 'app') return appRoot
  if (repo === '容器') return repoRoot
  return repoRoot
}

const specText = readFileOrExit(specPath)
const casesText = readFileOrExit(casesPath)

const specIds = parseSpecIds(specText)
const rows = parseCaseRows(casesText)

const problems = []
const report = { covered: 0, manual: 0, missing: 0, partial: 0 }
const seen = new Set()

for (const row of rows) {
  if (seen.has(row.id)) {
    problems.push(`用例文档中 ${row.id} 重复登记`)
  }
  seen.add(row.id)

  if (!specIds.has(row.id)) {
    problems.push(`${row.id} 在需求文档中不存在（用例文档写了不存在的需求）`)
  }

  const refs = parseRefs(row.refs)
  const isGreen = row.status.includes('✅')

  if (isGreen && refs.length === 0) {
    problems.push(`${row.id} 标为 ✅ 但没有登记任何验证位置`)
  }

  for (const ref of refs) {
    const root = repoRootOf(ref.repo)
    const abs = path.join(root, ref.filePath)
    if (!fs.existsSync(abs)) {
      problems.push(`${row.id} 的验证位置指向不存在的文件：${ref.raw}`)
      continue
    }
    if (ref.name) {
      const content = fs.readFileSync(abs, 'utf8')
      if (!content.includes(ref.name)) {
        problems.push(`${row.id} 的验证位置指向的用例已不存在：${ref.raw}`)
      }
    }
  }

  if (row.status.includes('✅')) report.covered++
  else if (row.status.includes('⚠️')) report.manual++
  else if (row.status.includes('❌')) report.missing++
  else if (row.status.includes('🔸')) report.partial++
}

// 需求文档里有、但用例文档没登记的 → 漏覆盖（章节分组号不算）
const unregistered = [...specIds].filter((id) => isLeafId(id) && !seen.has(id)).sort()

console.log('需求覆盖检查')
console.log(`  需求文档：${path.relative(repoRoot, specPath)}`)
console.log(`  用例文档：${path.relative(repoRoot, casesPath)}`)
console.log(`  子项目：  ${appRoot}`)
console.log('')
console.log('状态分布')
console.log(`  ✅ 有自动化验证   ${report.covered}`)
console.log(`  🔸 部分覆盖       ${report.partial}`)
console.log(`  ⚠️ 仅人工验收     ${report.manual}`)
console.log(`  ❌ 未实现         ${report.missing}`)
console.log('')

if (unregistered.length) {
  console.log(`❌ 未登记用例的需求（${unregistered.length}）`)
  for (const id of unregistered) console.log(`   - ${id}`)
  console.log('')
}

if (problems.length) {
  console.log(`❌ 结构性问题（${problems.length}）`)
  for (const p of problems) console.log(`   - ${p}`)
  console.log('')
}

const failed = problems.length > 0 || unregistered.length > 0
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS')
process.exit(failed ? 1 : 0)
