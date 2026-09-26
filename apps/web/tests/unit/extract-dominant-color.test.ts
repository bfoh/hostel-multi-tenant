/**
 * Unit tests for pickDominantColor() (lib/color/extract-dominant-color.ts) —
 * the pure pixel-bucketing/scoring logic used to auto-fill a tenant's
 * primary_color from an uploaded logo. This function takes a plain RGBA
 * byte array, not a File/canvas, so it runs under this project's default
 * Node vitest environment with no jsdom/canvas mocking needed — the thin
 * File → canvas → getImageData loading glue (loadImageData) is left to live
 * verification since it's DOM-only and has no interesting logic of its own.
 */
import { describe, expect, it } from 'vitest'
import { pickDominantColor } from '@/lib/color/extract-dominant-color'

/** Builds an RGBA buffer from a flat list of [r,g,b,a] pixels. */
function pixels(...rows: [number, number, number, number][]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(rows.length * 4)
  rows.forEach(([r, g, b, a], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a
  })
  return data
}

function repeat(pixel: [number, number, number, number], count: number): [number, number, number, number][] {
  return Array.from({ length: count }, () => pixel)
}

describe('pickDominantColor', () => {
  it('picks a vivid accent color over a dominant white background', () => {
    const data = pixels(
      ...repeat([255, 255, 255, 255], 200), // white background, filtered out
      ...repeat([30, 90, 220, 255], 20),    // blue logo mark
    )
    expect(pickDominantColor(data)).toBe('#1e5adc')
  })

  it('returns null for a fully transparent image', () => {
    const data = pixels(...repeat([10, 10, 10, 0], 50))
    expect(pickDominantColor(data)).toBeNull()
  })

  it('returns null when only near-white and near-black pixels are present', () => {
    const data = pixels(
      ...repeat([255, 255, 255, 255], 100),
      ...repeat([0, 0, 0, 255], 100),
    )
    expect(pickDominantColor(data)).toBeNull()
  })

  it('lets a dominant mid-tone neutral win when nothing colorful survives filtering', () => {
    // Mid-gray isn't near-white/near-black, so it isn't collection-filtered,
    // and the 0.3 scoring floor lets a purely desaturated color still win.
    const data = pixels(...repeat([128, 128, 128, 255], 50))
    expect(pickDominantColor(data)).toBe('#808080')
  })

  it('favors a smaller but more saturated bucket over a larger, duller one', () => {
    const data = pixels(
      ...repeat([120, 120, 130, 255], 60), // frequent, low-saturation gray-blue
      ...repeat([220, 30, 30, 255], 25),   // less frequent, highly saturated red
    )
    expect(pickDominantColor(data)).toBe('#dc1e1e')
  })
})
