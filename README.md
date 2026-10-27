# Fusion

**Fusion** is a local-first photo collage editor: pick photos, arrange a layout, style the frame, add a watermark, and export — entirely in your browser.

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Language:** English · [简体中文](README.zh-CN.md)

## Why Fusion?

Photos never leave your device. There is no account, no upload API, and no cloud sync — images live in memory / object URLs for the session. Use Fusion for social posts, print-oriented frames, or quick multi-photo layouts.

## Features

### Collage workspace (`/`)

- Built-in layout catalog with favorites; overlay sidebars (stage insets at ≥1024px width)
- Fill cells via file picker or drag-and-drop; clear one cell or all images
- Per-cell pan / zoom, rotate & flip (eager bitmap bake in a Web Worker), drag to swap cells
- Drag shared gutters to resize tracks without changing image count
- Style: spacing, corner radius, per-side borders, background color or image
- Aspect ratio: **common** presets (1:1, 3:2, 4:3, 5:4, 16:9, 16:10), **print** sizes (mm pairs with orientation swap), **custom** width × height
- Watermark: on/off, text, size, opacity, rotation, tile or single placement
- Export: high / medium JPG, PNG; clipboard copy with download fallback
- UI: light / dark / system theme; zh-CN / en (vue-i18n)

### Custom layout (`/custom-layout`)

- Grid editor to add, move, and resize blocks, then apply the layout back to the main collage
- JSON panel for power users; draft handoff into the collage session

### Runtime

- Installable PWA shell (`vite-plugin-pwa`) — app assets may be cached; **user photos are not precached**
- Image decode and orientation bake run in Web Workers; export draws with Canvas locally

## Tech stack

| Area     | Choice                                                                                        |
| -------- | --------------------------------------------------------------------------------------------- |
| UI       | Vue 3, Vue Router, Pinia, Tailwind CSS v4, Lucide                                             |
| Language | TypeScript, vue-i18n, Zod                                                                     |
| Tooling  | Vite 7, ESLint, Prettier, Vitest, Husky, lint-staged, pnpm                                    |
| Workers  | `imageDecode` / `imageBake` (ES modules)                                                      |
| Hosting  | Static SPA — Cloudflare Pages ready (`wrangler.toml`, `public/_redirects`, `public/_headers`) |

## Requirements

- **Node.js** 20+ (22 recommended; see `.nvmrc`)
- **pnpm** 9+ (lockfile is `pnpm-lock.yaml` — do not mix npm/yarn locks)

## Development

```bash
pnpm install
pnpm dev
```

Open the URL printed by Vite.

| Command                       | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `pnpm dev`                    | Dev server                                      |
| `pnpm build`                  | `vue-tsc --noEmit` + production build → `dist/` |
| `pnpm preview`                | Preview production build                        |
| `pnpm lint`                   | ESLint                                          |
| `pnpm format`                 | Prettier write                                  |
| `pnpm typecheck`              | Typecheck only                                  |
| `pnpm test` / `pnpm test:run` | Vitest watch / CI once                          |
| `pnpm icons:pwa`              | Regenerate PWA icons from `public/favicon.svg`  |

CI (GitHub Actions): lint → typecheck → test → build on `main` / pull requests.

## Build & deploy

```bash
pnpm build
```

Output directory: `dist/`.

### Cloudflare Pages

| Setting          | Value                                |
| ---------------- | ------------------------------------ |
| Build command    | `pnpm run build`                     |
| Output directory | `dist`                               |
| Node version     | `22` (`NODE_VERSION=22` recommended) |

SPA fallback for client routes is provided by `public/_redirects` (`/* → /index.html` 200). Cache headers in `public/_headers` keep `index.html` / `sw.js` revalidating while hashed `/assets/*` stay immutable. Optional CLI:

```bash
pnpm build
npx wrangler pages deploy dist --project-name=fusion
```

Any static host that serves `dist/` and rewrites unknown paths to `index.html` also works.

## Project layout

```
src/
  app/          # Shell, router, plugins, global styles
  pages/        # Route pages (thin composition)
  features/     # canvas, layout-editor, export, images, watermark
  entities/     # Layout schema, session types
  shared/       # UI primitives, libs, workers
  locales/      # zh-CN, en (keep keys in sync)
public/         # favicon, PWA icons, robots.txt, _redirects, _headers
```

Layout JSON describes the grid only. Session style, cell images, and transforms live in app state — they are not written into layout files.

## License

MIT — see [LICENSE](LICENSE).
