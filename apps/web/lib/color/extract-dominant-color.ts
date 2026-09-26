/**
 * Client-side dominant-color extraction for uploaded logos, so the branding
 * step can auto-fill a matching primary_color instead of the owner having to
 * pick one by hand. No image-processing library exists anywhere in this repo
 * (sharp/node-vibrant/colorthief etc.) and the logo is already a browser
 * File before upload, so this is a small dependency-free canvas sampler
 * rather than a backend step.
 *
 * Split into a DOM-touching loader and a pure picker so the actual
 * color-picking logic is unit-testable without jsdom/canvas mocking (see
 * tests/unit/extract-dominant-color.test.ts).
 */

const SAMPLE_MAX_DIM = 64

async function loadImageData(file: File): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const ratio = Math.min(1, SAMPLE_MAX_DIM / Math.max(img.width, img.height))
    const width  = Math.max(1, Math.round(img.width * ratio))
    const height = Math.max(1, Math.round(img.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    return { width, height, data }
  } catch {
    // Decode failure, tainted canvas, etc. — this is a nice-to-have
    // enhancement and must never block the actual logo upload.
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255, gf = g / 255, bf = b / 255
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    switch (max) {
      case rf: h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6; break
      case gf: h = ((bf - rf) / d + 2) / 6; break
      case bf: h = ((rf - gf) / d + 4) / 6; break
    }
  }
  return [h, s, l]
}

function toHex(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
}

/**
 * Pure pixel-bucketing/scoring — no DOM. `data` is RGBA bytes as produced by
 * CanvasRenderingContext2D.getImageData (or an equivalent synthetic fixture
 * in tests).
 */
export function pickDominantColor(data: Uint8ClampedArray): string | null {
  type Bucket = { count: number; rSum: number; gSum: number; bSum: number }
  const buckets = new Map<number, Bucket>()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]

    if (a < 128) continue                                       // transparent
    if (r > 245 && g > 245 && b > 245) continue                  // near-white background
    if (r < 12 && g < 12 && b < 12) continue                     // near-black background/outline

    // Quantize to 4 bits/channel to collapse anti-aliased near-duplicates,
    // but keep the original 8-bit sums so the output color is a true
    // average, not a blocky quantization level.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.count++
      bucket.rSum += r; bucket.gSum += g; bucket.bSum += b
    } else {
      buckets.set(key, { count: 1, rSum: r, gSum: g, bSum: b })
    }
  }

  let best: { r: number; g: number; b: number; l: number; score: number } | null = null
  for (const { count, rSum, gSum, bSum } of buckets.values()) {
    const r = rSum / count, g = gSum / count, b = bSum / count
    const [, s, l] = rgbToHsl(r, g, b)
    // Favor a vivid, brand-recognizable color over a merely-frequent dull
    // one, while still letting a dominant neutral win if nothing colorful
    // survived filtering (the 0.3 floor).
    const score = count * (0.3 + 0.7 * s)
    if (!best || score > best.score) best = { r, g, b, l, score }
  }

  if (!best) return null
  if (best.l < 0.06 || best.l > 0.94) return null // still effectively black/white

  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`
}

/** Never throws — every failure path resolves null so callers can fire-and-forget. */
export async function extractDominantColor(file: File): Promise<string | null> {
  const image = await loadImageData(file)
  if (!image) return null
  return pickDominantColor(image.data)
}
