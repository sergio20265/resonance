import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const assets = [
  ['public/vintage/vu-face.png', 'public/vintage/vu-face.webp', 82],
  ['public/vintage/vu-needle.png', 'public/vintage/vu-needle.webp', 84],
  ['public/vintage/knob.png', 'public/vintage/knob.webp', 82],
  ['public/vintage/toggle.png', 'public/vintage/toggle.webp', 82],
]

await mkdir('public/vintage', { recursive: true })

for (const [input, output, quality] of assets) {
  await sharp(input)
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toFile(output)
}
