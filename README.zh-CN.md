# Fusion

**Fusion** 是一款本地优先的照片拼图编辑器：选图、排版、调样式、加水印、导出 — 全程在浏览器完成。

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**语言：** [English](README.md) · 简体中文

## 为什么是 Fusion？

照片不出本机：无需账号、无需上传接口、不做云端同步。图片仅存在于当次会话的内存 / Object URL。适合社媒拼图、打印画幅，或快速多图排版。

## 功能

### 主拼贴（`/`）

- 内置布局目录与收藏；浮层侧栏（视口宽度 ≥1024px 时舞台左右 inset）
- 点击空格选图或拖放填图；可清除单格或全部图片
- 单元格平移 / 缩放、旋转与翻转（Web Worker eager bake）、拖拽换图
- 拖动共边槽缝调整轨道比例（不改变图片数量）
- 样式：间距、圆角、四边边框、背景色或背景图
- 画幅：**常见比例**（1:1、3:2、4:3、5:4、16:9、16:10）、**打印尺寸**（mm，含方向交换）、**自定义**宽高
- 水印：开关、文案、字号、透明度、旋转、平铺或单点
- 导出：高清 / 标准 JPG、PNG；剪贴板复制（失败则回退下载）
- 界面：浅色 / 深色 / 跟随系统；中英双语（vue-i18n）

### 自定义布局（`/custom-layout`）

- 网格编辑：增删、移动、缩放块，再应用回主拼贴
- JSON 面板；草稿交接进拼贴会话

### 运行时

- 可安装为 PWA（`vite-plugin-pwa`）— 可缓存应用壳；**不会预缓存用户照片**
- 图片解码与方向 bake 走 Web Worker；导出使用本地 Canvas 绘制

## 技术栈

| 领域   | 选型                                                                                          |
| ------ | --------------------------------------------------------------------------------------------- |
| UI     | Vue 3、Vue Router、Pinia、Tailwind CSS v4、Lucide                                             |
| 语言   | TypeScript、vue-i18n、Zod                                                                     |
| 工程   | Vite 7、ESLint、Prettier、Vitest、Husky、lint-staged、pnpm                                    |
| Worker | `imageDecode` / `imageBake`（ES module）                                                      |
| 托管   | 静态 SPA — 已适配 Cloudflare Pages（`wrangler.toml`、`public/_redirects`、`public/_headers`） |

## 环境要求

- **Node.js** 20+（推荐 22，见 `.nvmrc`）
- **pnpm** 9+（锁文件为 `pnpm-lock.yaml`，请勿混用 npm/yarn 锁）

## 本地开发

```bash
pnpm install
pnpm dev
```

按 Vite 终端提示打开本地地址。

| 命令                          | 说明                                      |
| ----------------------------- | ----------------------------------------- |
| `pnpm dev`                    | 开发服务器                                |
| `pnpm build`                  | `vue-tsc --noEmit` + 生产构建 → `dist/`   |
| `pnpm preview`                | 预览构建产物                              |
| `pnpm lint`                   | ESLint                                    |
| `pnpm format`                 | Prettier 写入                             |
| `pnpm typecheck`              | 仅类型检查                                |
| `pnpm test` / `pnpm test:run` | Vitest 监听 / CI 单次                     |
| `pnpm icons:pwa`              | 从 `public/favicon.svg` 重新生成 PWA 图标 |

CI（GitHub Actions）：在 `main` / PR 上依次执行 lint → typecheck → test → build。

## 构建与部署

```bash
pnpm build
```

产物目录：`dist/`。

### Cloudflare Pages

| 配置项           | 值                                 |
| ---------------- | ---------------------------------- |
| Build command    | `pnpm run build`                   |
| Output directory | `dist`                             |
| Node 版本        | `22`（建议设置 `NODE_VERSION=22`） |

前端路由回退由 `public/_redirects` 提供（`/* → /index.html` 200）。`public/_headers` 让 `index.html` / `sw.js` 每次校验最新，带 hash 的 `/assets/*` 则长期缓存。也可使用 Wrangler：

```bash
pnpm build
npx wrangler pages deploy dist --project-name=fusion
```

其它能托管 `dist/` 并为未知路径回退到 `index.html` 的静态主机同样适用。

## 目录结构

```
src/
  app/          # 应用壳、路由、插件、全局样式
  pages/        # 路由页（薄层组合）
  features/     # canvas、layout-editor、export、images、watermark
  entities/     # 布局 Schema、会话类型
  shared/       # 通用 UI、工具库、Worker
  locales/      # zh-CN、en（键需保持对等）
public/         # favicon、PWA 图标、robots.txt、_redirects、_headers
```

布局 JSON 只描述网格；样式、单元格图片与变换保存在会话状态中，不写入布局文件。

## 持久化

| 内容                                             | 存储位置                         | 生命周期   |
| ------------------------------------------------ | -------------------------------- | ---------- |
| 拼贴样式（间距、圆角、边框、颜色、水印设置）     | `localStorage` 的 `fusion:style` | 刷新后保留 |
| 样式背景图                                       | IndexedDB（由样式载荷引用）      | 刷新后保留 |
| 单元格照片 / 平移缩放 / 方向变换                 | 仅会话内存                       | 刷新后丢失 |
| 界面偏好（主题、语言、侧栏折叠、样式面板分区等） | `fusion:*` `localStorage` 键     | 刷新后保留 |

**重置样式** 会立即清除已持久化的样式 JSON 与 IndexedDB 背景，刷新后回到默认。单元格照片不受影响。

**多标签页：** 样式持久化为跨标签 last-write-wins，无实时同步。调样式时建议只开一个活动标签页。

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
