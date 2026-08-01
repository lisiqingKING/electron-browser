#!/usr/bin/env node
// Usage: node scripts/release.mjs 1.0.0
// Or:    npm run release 1.0.0

import { execSync } from 'child_process'

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/release.mjs <version>')
  process.exit(1)
}

const tag = `v${version}`
const branch = `release/v${version}`

console.log(`Creating ${branch} and tag ${tag}...`)

execSync(`git checkout -b ${branch}`, { stdio: 'inherit' })
execSync(`git add -A && git commit -m "chore: prepare release ${tag}"`, { stdio: 'inherit' })
execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'inherit' })
execSync(`git push origin ${branch} ${tag}`, { stdio: 'inherit' })

console.log(`Done: ${branch} pushed, ${tag} pushed. CI will build and publish.`)
