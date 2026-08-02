import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// 1. 构建 internal-app
console.log('[build-subapp] Building internal-app...')
execSync('npm run build', { cwd: 'C:/Users/lsq/my-projects/app', stdio: 'inherit' })

// 2. 拷贝到容器
console.log('[build-subapp] Copying dist to apps/internal-app...')
const src = 'C:/Users/lsq/my-projects/app/dist'
const dest = path.join(rootDir, 'apps/internal-app')
execSync(`xcopy /E /I /Y "${src}" "${dest}"`, { stdio: 'inherit' })

// 3. 构建容器
console.log('[build-subapp] Building container...')
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })

console.log('[build-subapp] Done.')
