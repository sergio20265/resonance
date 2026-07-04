import sharp from 'sharp'
import path from 'node:path'

const src = '1465.png'
const res = 'android/app/src/main/res'
const crop = { left: 100, top: 260, width: 840, height: 840 }
const background = '#14100b'

const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
]

const circleMask = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`)

const baseBuf = await sharp(src).extract(crop).png().toBuffer()
await sharp(baseBuf).resize(512).toFile(path.join('scripts', 'icon-preview.png'))

for (const [name, legacy, fg] of densities) {
  const dir = path.join(res, `mipmap-${name}`)

  const content = await sharp(baseBuf).resize(Math.round(legacy * 0.94)).png().toBuffer()
  const legacyBuf = await sharp({ create: { width: legacy, height: legacy, channels: 4, background } })
    .composite([{ input: content, gravity: 'centre' }])
    .png()
    .toBuffer()
  await sharp(legacyBuf).toFile(path.join(dir, 'ic_launcher.png'))
  await sharp(legacyBuf)
    .composite([{ input: circleMask(legacy), blend: 'dest-in' }])
    .png()
    .toFile(path.join(dir, 'ic_launcher_round.png'))

  const fgContent = await sharp(baseBuf).resize(Math.round(fg * 0.6)).png().toBuffer()
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fgContent, gravity: 'centre' }])
    .png()
    .toFile(path.join(dir, 'ic_launcher_foreground.png'))
}

console.log('icons done')
