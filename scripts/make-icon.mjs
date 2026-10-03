/**
 * Generates build/icon.png, the source electron-builder derives the Windows
 * .ico from.
 *
 * Written by hand rather than pulled from a canvas or image library: the whole
 * mark is a rounded square and a triangle, which is not worth a dependency in a
 * project whose premise is staying small. PNG is encoded directly (zlib is in
 * the standard library) with 4x4 supersampling for clean edges.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SIZE = 256
const SAMPLES = 4 // per axis, so 16 samples per pixel

// Matches the app's own palette (src/index.css).
const SURFACE = [0x15, 0x15, 0x1c]
const BORDER = [0x2a, 0x2a, 0x36]
const ACCENT = [0xff, 0x4d, 0x4f]

const CORNER_RADIUS = 56
const BORDER_WIDTH = 3

const TRIANGLE = [
  [102, 74],
  [102, 182],
  [188, 128]
]

/** Signed distance to a rounded square centred on the canvas. Negative inside. */
function roundedSquareDistance(x, y) {
  const half = SIZE / 2
  const inner = half - CORNER_RADIUS
  const dx = Math.max(Math.abs(x - half) - inner, 0)
  const dy = Math.max(Math.abs(y - half) - inner, 0)
  return Math.hypot(dx, dy) - CORNER_RADIUS
}

function insideTriangle(x, y) {
  const [[ax, ay], [bx, by], [cx, cy]] = TRIANGLE
  const sign = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px)
  const d1 = sign(ax, ay, bx, by, x, y)
  const d2 = sign(bx, by, cx, cy, x, y)
  const d3 = sign(cx, cy, ax, ay, x, y)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[i] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  // Each scanline is prefixed with its filter type; 0 means "none".
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const pixels = Buffer.alloc(SIZE * SIZE * 4)
const step = 1 / SAMPLES
const perPixel = SAMPLES * SAMPLES

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let bodyHits = 0
    let borderHits = 0
    let triangleHits = 0

    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const px = x + (sx + 0.5) * step
        const py = y + (sy + 0.5) * step
        const dist = roundedSquareDistance(px, py)
        if (dist > 0) continue
        bodyHits++
        if (dist > -BORDER_WIDTH) borderHits++
        else if (insideTriangle(px, py)) triangleHits++
      }
    }

    const offset = (y * SIZE + x) * 4
    if (bodyHits === 0) continue

    // Blend the three regions by their sub-sample coverage.
    const base = borderHits >= bodyHits - borderHits ? BORDER : SURFACE
    const borderMix = borderHits / bodyHits
    const triangleMix = triangleHits / bodyHits

    const surfaceMix = Math.max(0, 1 - borderMix - triangleMix)
    for (let c = 0; c < 3; c++) {
      pixels[offset + c] = Math.round(
        BORDER[c] * borderMix + ACCENT[c] * triangleMix + SURFACE[c] * surfaceMix + base[c] * 0
      )
    }
    pixels[offset + 3] = Math.round((bodyHits / perPixel) * 255)
  }
}

const outPath = resolve(process.argv[2] ?? 'build/icon.png')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, encodePng(pixels, SIZE, SIZE))
console.log(`wrote ${outPath} (${SIZE}x${SIZE})`)
