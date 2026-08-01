#!/usr/bin/env node
// Usage: node scripts/release.mjs 1.0.0
// Or:    npm run release 1.0.0
//
// 前置条件:
//   1. package.json version 已改为目标版本
//   2. 代码已 git add + git commit
//
// 行为:
//   - tag 不存在 → 创建并推送
//   - tag 已存在 → 报错退出,提示升级版本号

import { execSync } from 'child_process'

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/release.mjs <version>')
  process.exit(1)
}

const tag = `v${version}`

// 检查 remote tag 是否存在
function tagExistsRemote(tag) {
  try {
    const output = execSync(`git ls-remote --tags origin ${tag}`, { stdio: 'pipe' }).toString()
    return output.includes(`refs/tags/${tag}`)
  } catch {
    return false
  }
}

if (tagExistsRemote(tag)) {
  console.error(`[release] Error: ${tag} already exists on remote.`)
  console.error(`[release] To fix: bump your version number and try again.`)
  console.error(`[release] For example: npm run release ${parseInt(version.split('.')[2]) + 1}`)
  process.exit(1)
}

console.log(`[release] Creating ${tag}...`)
execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'inherit' })

console.log(`[release] Pushing ${tag} to origin...`)
execSync(`git push origin ${tag}`, { stdio: 'inherit' })

console.log(`[release] Done: ${tag} pushed. CI will build and publish.`)
