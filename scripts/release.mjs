#!/usr/bin/env node
// 发布脚本:从 package.json 读取 version,创建 release 分支并推送
// Usage: npm run release

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 读取 package.json 的 version
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'))
const version = pkg.version
if (!version) {
  console.error('[release] Error: package.json has no version field')
  process.exit(1)
}

const branch = `release/v${version}`
console.log(`[release] Creating ${branch}...`)

// 创建并推送 release 分支
execSync(`git checkout -b ${branch}`, { stdio: 'inherit' })
execSync(`git push origin ${branch}`, { stdio: 'inherit' })

console.log(`[release] Done: ${branch} pushed. CI will build and publish.`)
