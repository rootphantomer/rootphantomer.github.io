# rootphantomer.github.io

个人主页 —— 静态站点，部署在 GitHub Pages。

**线上地址**：https://rootphantomer.github.io/

## 技术说明

- 纯静态：`index.html` + `assets/css/style.css` + `assets/js/main.js`
- 无构建步骤、无 npm 依赖、无外部 CDN（不依赖 Google Fonts，国内外访问都稳）
- 主题：暗色 / 亮色切换，状态存 `localStorage`，首次跟随系统偏好
- 数据：页面直接调用 GitHub REST API（`api.github.com`）拉取仓库数、Followers、Star 等，
  结果缓存到 `sessionStorage`（10 分钟），避免重复请求；接口不可用时依次回退到
  `data/stats.json` 快照和 `index.html` 内嵌值
- 遵循 `prefers-reduced-motion`，减少动画偏好下关闭动效

## 数据是怎么拿的

页面加载时按这个顺序取数据：

1. **GitHub API** —— 实时数据。匿名请求限额是每 IP 60 次/小时，
   共享出口 IP（公司代理、NAT）比较容易撞上限流。
2. **`data/stats.json`** —— 静态快照，由 `scripts/update-stats.mjs` 生成，
   仓库内已有一份。API 不可用时使用。
3. **`index.html` 内嵌值** —— 最后兜底，保证页面永远不是空的。

## 目录结构

```
.
├── .nojekyll            # 跳过 Jekyll 处理
├── index.html           # 页面结构
├── assets/
│   ├── css/style.css    # 样式与设计令牌
│   ├── js/main.js       # 主题切换、导航、滚动动画、GitHub API 拉取
│   └── favicon.svg
├── data/stats.json      # 静态数据快照（API 不可用时的兜底）
├── scripts/
│   └── update-stats.mjs # 生成上面的快照
├── .github/workflows/
│   └── update-stats.yml # 手动刷新快照（workflow_dispatch）
└── README.md
```

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 发布

仓库 `main` 分支即线上内容，推送后 GitHub Pages 自动构建：

```bash
git add -A
git commit -m "update site"
git push origin main
```

构建状态可在仓库的 **Settings → Pages** 查看。

## 刷新数据快照

快照默认不会自动更新（工作流只保留手动触发，避免每小时产生一条提交）。
需要刷新时二选一：

- 本地生成并提交：

  ```bash
  GITHUB_TOKEN=$(gh auth token) node scripts/update-stats.mjs
  git add data/stats.json && git commit -m "chore: update site stats" && git push
  ```

- 在仓库 **Actions → Update site stats** 页面点 **Run workflow**。

另外，页面上的项目列表本身来自 GitHub API，新增仓库后**无需**手动维护；
只有 API 不可用时才会用到这份快照。
