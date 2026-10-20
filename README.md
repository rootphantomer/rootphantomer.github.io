# rootphantomer.github.io

个人主页 —— 静态站点，部署在 GitHub Pages。

**线上地址**：https://rootphantomer.github.io/

## 技术说明

- 纯静态：`index.html` + `assets/css/style.css` + `assets/js/main.js`
- 无构建步骤、无 npm 依赖、无外部 CDN（不依赖 Google Fonts，国内外访问都稳）
- 主题：暗色 / 亮色切换，状态存 `localStorage`，首次跟随系统偏好
- 数据：通过 GitHub REST API（`api.github.com`）实时拉取仓库数、Followers、Star 等，
  结果缓存到 `sessionStorage`（30 分钟）；接口不可用时静默回退到页面内的静态快照
- 遵循 `prefers-reduced-motion`，减少动画偏好下关闭动效

## 目录结构

```
.
├── .nojekyll            # 跳过 Jekyll 处理
├── index.html           # 页面结构
├── assets/
│   ├── css/style.css    # 样式与设计令牌
│   ├── js/main.js       # 主题切换、导航、滚动动画、GitHub API 拉取
│   └── favicon.svg
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

## 更新项目列表

项目数据来自 GitHub API，一般无需手动维护。如果新增了项目，
等 API 缓存过期后会自动出现在「更多仓库」列表中；
需要立即生效的话，修改 `index.html` 中 `reposList` 的静态快照即可。
