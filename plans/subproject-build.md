# Plan: 子项目构建脚本

## Context

每次修改 `internal-app` 后,需要手动:
1. `cd C:\Users\lsq\my-projects\app && npm run build`
2. 拷贝 `app/dist/` → `electron-vite-project/apps/internal-app/dist/`
3. `cd electron-vite-project && npm run build`

用户需要一个命令自动完成这个流程。

## 方案

在容器项目根目录建 `scripts/build-subapp.mjs`:

```js
// 1. 构建 internal-app
execSync('npm run build', { cwd: 'C:/Users/lsq/my-projects/app', stdio: 'inherit' })

// 2. 拷贝 dist 到 apps/internal-app/dist
execSync('xcopy /E /I /Y "C:\\Users\\lsq\\my-projects\\app\\dist" "apps\\internal-app\\dist"', { stdio: 'inherit' })

// 3. 构建容器
execSync('npm run build', { stdio: 'inherit' })
```

## package.json 添加命令

```json
"scripts": {
  "build:subapp": "node scripts/build-subapp.mjs"
}
```

## 验证

```bash
npm run build:subapp
```

执行后:
- `apps/internal-app/dist/` 有最新构建产物
- 容器 `dist-electron/` 更新
