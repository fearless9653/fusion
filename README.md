# Fusion

本地拼图编辑器 — 选图、排版、样式、水印与导出，全在浏览器完成。

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## 简介

**Fusion** 是一款纯前端的照片拼图应用：把多张本地图片填进布局模板，调整间距、圆角、边框与背景，可选水印，再导出 JPG/PNG 或复制到剪贴板。无需账号、无需后端，数据不出浏览器。

## 功能特性

**核心**

- 主拼贴工作台：内置布局目录、单元格填图 / 替换、平移缩放、拖拽交换
- 样式：间距、圆角、四边边框、背景色 / 背景图、画幅比例（常见比、打印尺寸、自定义）
- 水印：开关、文案、字号、透明度、旋转、平铺 / 单点位置
- 导出：高清 / 标准 JPG、PNG；剪贴板复制（失败时回退下载）

**扩展**

- 自定义布局编辑器：网格增删改 → JSON → 应用到主拼贴
- 外观：浅色 / 深色 / 跟随系统；界面中英双语（默认跟随浏览器，可手动切换）

## 快速开始

**环境**

- Node.js 20+（推荐 22，见仓库 `.nvmrc`）
- [pnpm](https://pnpm.io/) 9+（本仓库使用 `pnpm-lock.yaml`，请勿混用 npm/yarn 锁文件）

**安装与运行**

```bash
pnpm install
pnpm dev
```

浏览器打开终端提示的本地地址即可。生产构建：

```bash
pnpm build
pnpm preview
```

## 使用说明

| 路径             | 说明                                         |
| ---------------- | -------------------------------------------- |
| `/`              | 主拼贴：左侧选布局，中间画布，右侧样式与导出 |
| `/custom-layout` | 自定义布局：编辑网格后「使用此布局」回到主站 |

顶栏：语言下拉（中文 / English）、主题图标循环（浅色 → 深色 → 跟随系统）。

## 技术栈

- Vue 3 · TypeScript · Vite
- Vue Router · Pinia · Tailwind CSS v4（品牌色 emerald）
- vue-i18n · Zod · Lucide
- Web Worker 解码图片 · Canvas 自绘导出
- ESLint · Prettier · Vitest · Husky · GitHub Actions CI · pnpm

## 目录结构

```
src/
  app/         # 应用壳、路由、插件、主题 token
  pages/       # 路由页（薄层组合）
  features/    # canvas / layout-editor / export / watermark / images
  entities/    # 布局 Schema v1、会话类型
  shared/      # 通用 UI、工具、Worker
  locales/     # zh-CN、en（键需保持对等）
public/        # 静态资源（favicon、_redirects）
```

布局 JSON 只描述网格；样式、单元格图片与变换在会话状态中，不写入布局文件。

## 开发脚本

| 命令                     | 说明                |
| ------------------------ | ------------------- |
| `pnpm dev`               | 开发服务器          |
| `pnpm build`             | 类型检查 + 生产构建 |
| `pnpm preview`           | 预览构建产物        |
| `pnpm lint`              | ESLint              |
| `pnpm format`            | Prettier 写入       |
| `pnpm typecheck`         | `vue-tsc --noEmit`  |
| `pnpm test` / `test:run` | Vitest 监听 / 单次  |

## 部署

### Cloudflare Pages

本项目为 Vite SPA，构建产物在 `dist/`。仓库已包含：

- `public/_redirects`：`/* → /index.html`（200），保证 `/custom-layout` 等前端路由刷新不 404
- `wrangler.toml`：`pages_build_output_dir = "dist"`（本地 `wrangler pages` 调试可用）

在 Cloudflare Dashboard → Workers & Pages → Create → Connect to Git：

| 设置项                 | 值               |
| ---------------------- | ---------------- |
| Framework preset       | Vite（或 None）  |
| Build command          | `pnpm run build` |
| Build output directory | `dist`           |
| Root directory         | `/`（仓库根）    |

环境变量 / 构建配置建议：

- **Node.js version**：`22`（与 `.nvmrc` 一致；在 Pages → Settings → Environment variables 或 Build configuration 中设置 `NODE_VERSION=22`）
- 包管理：Pages 检测到 `pnpm-lock.yaml` 时会使用 pnpm；请保持锁文件提交在仓库中

部署后直接打开站点即可；SPA 回退由 `_redirects` 处理，无需额外 Worker。

也可使用 Wrangler CLI（需已登录）：

```bash
pnpm build
npx wrangler pages deploy dist --project-name=fusion
```

## 贡献

欢迎 Issue / PR。提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/)（英文），例如 `feat:`、`fix:`、`chore:`。

提交前建议：

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

## PWA

支持安装为 Progressive Web App（`vite-plugin-pwa`）：生产构建会生成 Web App Manifest 与 Service Worker，可缓存应用壳（JS/CSS/HTML/图标）。**用户照片与导出结果不会进离线缓存**，仍依赖当次会话。

本地验证：`pnpm build && pnpm preview`，用 Chromium 打开预览地址 → 安装应用 / Application → Manifest & Service Workers。

重新生成图标（从 `public/favicon.svg`）：`pnpm icons:pwa`。

## SEO

`index.html` 提供可抓取的标题 / 描述 / `robots: index, follow` 与基础 OG；`public/robots.txt` 允许全部抓取（SPA 无 SSR，正文仍依赖客户端渲染）。

## 许可证

[MIT](LICENSE)
