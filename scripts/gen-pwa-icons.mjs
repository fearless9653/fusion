import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const favicon = path.join(root, 'public', 'favicon.svg')
const svg = fs.readFileSync(favicon)

async function writePng(size, outName, { maskable = false } = {}) {
  const out = path.join(root, 'public', outName)
  if (!maskable) {
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out)
    console.log('wrote', outName)
    return
  }
  const pad = Math.round(size * 0.1)
  const inner = size - pad * 2
  const icon = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    },
  })
    .composite([{ input: icon, left: pad, top: pad }])
    .png()
    .toFile(out)
  console.log('wrote', outName, '(maskable)')
}

await writePng(192, 'pwa-192x192.png')
await writePng(512, 'pwa-512x512.png')
await writePng(512, 'pwa-512x512-maskable.png', { maskable: true })
