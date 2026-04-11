'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Color math ────────────────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  const lf = l / 100
  const a  = (s / 100) * Math.min(lf, 1 - lf)
  const f  = (n: number) => {
    const k     = (n + h / 30) % 12
    const color = lf - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsl(hex: string): [number, number, number] | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

// 9 monochromatic shades at fixed lightness steps for the current hue+saturation
function generateShades(h: number, s: number): string[] {
  return [15, 25, 35, 45, 55, 65, 73, 82, 91].map(l => hslToHex(h, Math.max(s, 20), l))
}

// ── Preset palette ────────────────────────────────────────────────────────────

const PRESETS = [
  // Blues / navies
  '#1B4F72', '#1A5276', '#1F618D', '#154360',
  // Teals / greens
  '#0E6B5E', '#1C6458', '#117A65', '#0E8D6F',
  // Purples
  '#7B2D8B', '#6C3483', '#76448A', '#5B2C6F',
  // Reds / earthy
  '#B8251A', '#922B21', '#C0392B', '#7B241C',
  // Amber / gold
  '#C47A1E', '#B7770D', '#D4AC0D', '#9A7D0A',
  // Slate / dark
  '#2E4057', '#2C3E50', '#1C2833', '#17202A',
]

// ── Slider component ──────────────────────────────────────────────────────────

interface SliderProps {
  label:      string
  value:      number
  min:        number
  max:        number
  background: string
  thumbColor: string
  pct:        number      // 0-100 position for thumb
  onChange:   (v: number) => void
}

function ColorSlider({ label, value, min, max, background, thumbColor, pct, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-[11px] font-mono text-slate-500">{value}</p>
      </div>
      <div className="relative h-5 rounded-full" style={{ background }}>
        <input
          type="range"
          min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* Custom thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-white shadow-lg pointer-events-none transition-[left]"
          style={{
            left:            `calc(${pct}% - 10px)`,
            backgroundColor: thumbColor,
          }}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ColorPickerFieldProps {
  value:    string
  onChange: (hex: string) => void
}

export function ColorPickerField({ value, onChange }: ColorPickerFieldProps) {
  const parsed = hexToHsl(value) ?? [213, 62, 28]

  const [hue, setHue] = useState(parsed[0])
  const [sat, setSat] = useState(parsed[1])
  const [lit, setLit] = useState(parsed[2])
  const [hex, setHex] = useState(value || hslToHex(parsed[0], parsed[1], parsed[2]))

  // When parent changes value externally (e.g. preset click), re-sync HSL
  useEffect(() => {
    if (!value || value === hex) return
    const hsl = hexToHsl(value)
    if (!hsl) return
    setHue(hsl[0]); setSat(hsl[1]); setLit(hsl[2])
    setHex(value)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const apply = useCallback((h: number, s: number, l: number) => {
    const computed = hslToHex(h, s, l)
    setHex(computed)
    onChange(computed)
  }, [onChange])

  function handleHexInput(raw: string) {
    setHex(raw)
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      const hsl = hexToHsl(raw)
      if (hsl) { setHue(hsl[0]); setSat(hsl[1]); setLit(hsl[2]) }
      onChange(raw)
    }
  }

  const shades      = generateShades(hue, sat)
  const currentHex  = hslToHex(hue, sat, lit)
  const pureHue     = hslToHex(hue, 100, 50)

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">

      {/* ── Sliders ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <ColorSlider
          label="Hue"
          value={hue} min={0} max={360}
          background="linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)"
          thumbColor={pureHue}
          pct={hue / 360 * 100}
          onChange={h => { setHue(h); apply(h, sat, lit) }}
        />
        <ColorSlider
          label="Saturation"
          value={sat} min={0} max={100}
          background={`linear-gradient(to right,${hslToHex(hue,0,lit)},${hslToHex(hue,100,lit)})`}
          thumbColor={currentHex}
          pct={sat}
          onChange={s => { setSat(s); apply(hue, s, lit) }}
        />
        <ColorSlider
          label="Lightness"
          value={lit} min={5} max={92}
          background={`linear-gradient(to right,#111,${pureHue},#fff)`}
          thumbColor={currentHex}
          pct={(lit - 5) / 87 * 100}
          onChange={l => { setLit(l); apply(hue, sat, l) }}
        />
      </div>

      {/* ── Monochromatic shades ─────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Shades</p>
        <div className="grid grid-cols-9 gap-1.5">
          {shades.map((shade, i) => {
            const isActive = value.toLowerCase() === shade.toLowerCase()
            return (
              <button
                key={i}
                type="button"
                title={shade}
                onClick={() => {
                  const hsl = hexToHsl(shade)
                  if (hsl) { setHue(hsl[0]); setSat(hsl[1]); setLit(hsl[2]) }
                  setHex(shade)
                  onChange(shade)
                }}
                className={`aspect-square rounded-lg transition-all hover:scale-105 ${
                  isActive ? 'ring-2 ring-offset-2 ring-white shadow-lg scale-110' : ''
                }`}
                style={{ backgroundColor: shade }}
              />
            )
          })}
        </div>
        <div className="mt-1.5 flex justify-between px-0.5">
          <span className="text-[9px] text-slate-400">Dark</span>
          <span className="text-[9px] text-slate-400">Light</span>
        </div>
      </div>

      {/* ── Suggested presets ────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Suggested</p>
        <div className="grid grid-cols-8 gap-1.5">
          {PRESETS.map((c) => {
            const isActive = value.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => onChange(c)}
                className={`aspect-square rounded-lg transition-all hover:scale-105 ${
                  isActive ? 'ring-2 ring-offset-2 ring-white shadow-lg scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            )
          })}
        </div>
      </div>

      {/* ── Hex input + preview ──────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <div
          className="h-9 w-9 shrink-0 rounded-lg border border-border shadow-inner"
          style={{ backgroundColor: currentHex }}
        />
        <input
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors"
          value={hex}
          onChange={e => handleHexInput(e.target.value)}
          placeholder="#1B4F72"
          maxLength={7}
          spellCheck={false}
        />
        <div
          className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-white flex items-center shrink-0 shadow-sm"
          style={{ backgroundColor: currentHex }}
        >
          Preview
        </div>
      </div>
    </div>
  )
}
