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
//   - tag 存在,Release 不存在(CI 失败) → 删除 remote tag,重新推送
//   - tag 存在,Release 已存在 → 报错,需先手动删除 GitHub Release

import { execSync } from 'child_process'

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/release.mjs <version>')
  process.exit(1)
}

const tag = `v${version}`
const repo = 'lisiqingKING/electron-browser'

// 检查 remote tag 是否存在
function tagExistsRemote(tag) {
  try {
    const output = execSync(`git ls-remote --tags origin ${tag}`, { stdio: 'pipe' }).toString()
    return output.includes(`refs/tags/${tag}`)
  } catch {
    return false
  }
}

// 通过 GitHub API 检查 Release 是否已发布
function releaseExists(tag) {
  try {
    const token = process.env.GH_TOKEN
    const url = `https://api.github.com/repos/${repo}/releases/tags/${tag}`
    let cmd = `curl -s -H "Accept: application/vnd.github+json" "${url}"`
    if (token) {
      cmd += ` -H "Authorization: Bearer ${token}"`
    }
    const output = execSync(cmd, { stdio: 'pipe' }).toString()
    const json = JSON.parse(output)
    return json.id != null
  } catch {
    return false
  }
}

// 删除 remote tag
function deleteRemoteTag(tag) {
  console.log(`[release] Deleting remote ${tag}...`)
  execSync(`git push origin :refs/tags/${tag}`, { stdio: 'inherit' })
}

const remoteTag = tagExistsRemote(tag)

if (remoteTag) {
  const hasRelease = releaseExists(tag)
  if (hasRelease) {
    console.error(`[release] Error: ${tag} has an existing Release on GitHub.`)
    console.error(`[release] To re-publish, delete the Release first:`)
    console.error(`[release]   https://github.com/${repo}/releases`)
    process.exit(1)
  }
  // CI 失败,删除旧 tag 重新推送
  console.log(`[release] ${tag} exists but Release not found (CI likely failed). Re-publishing...`)
  deleteRemoteTag(tag)
}

console.log(`[release] Creating ${tag}...`)
execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'inherit' })

console.log(`[release] Pushing ${tag} to origin...`)
execSync(`git push origin ${tag}`, { stdio: 'inherit' })

console.log(`[release] Done: ${tag} pushed. CI will build and publish.`)
