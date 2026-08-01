#!/usr/bin/env node
// Usage: node scripts/release.mjs 1.0.0
// Or:    npm run release 1.0.0
//
// Prerequisites:
//   1. package.json version 已改为目标版本
//   2. 代码已 git add + git commit
//
// What it does:
//   打 v<version> tag → push → CI 构建 + 发布到 GitHub Releases

import { execSync } from 'child_process'

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/release.mjs <version>')
  process.exit(1)
}

const tag = `v${version}`
console.log(`Tagging ${tag} and pushing to origin...`)

execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'inherit' })
execSync(`git push origin ${tag}`, { stdio: 'inherit' })

console.log(`Done: ${tag} pushed. CI will build and publish.`)
