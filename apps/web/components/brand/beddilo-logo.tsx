/**
 * Beddilo brand marks — the lowercase "beddilo" wordmark and the
 * lowercase-b app icon, drawn as geometry rather than live text so they
 * render identically everywhere (SVG loaded via <img> can't use web fonts).
 *
 * The "b" bowl is an arched doorway with an amber bed inside it — the
 * same glyph is used in the wordmark and the app icon. Static copies of
 * these shapes live in public/logo.svg, public/logo-mark.svg and
 * public/icons/icon.svg (favicon, manifest, JSON-LD); keep them in sync.
 *
 * Letters use `currentColor`, so set the text color on the element
 * (Deep Teal on light surfaces, Warm Ivory on dark ones).
 */

const STROKE = 9
/** The icon's "b" is drawn heavier so it holds up at favicon sizes. */
const ICON_STROKE = 10.5
const BED_AMBER = '#F2B95A'

/** The "b" stem + arched bowl, in a 0 0 40 64 glyph box. */
const B_PATH = 'M4.5 6.5V59.5H29.5Q35.5 59.5 35.5 53.5V44A15.5 15.5 0 0 0 4.5 44'

/** Pillow + mattress; `lift` raises it clear of a heavier bowl stroke. */
function Bed({ lift = 0 }: { lift?: number }) {
  return (
    <>
      <rect x="14" y={41.5 - lift} width="12" height="4.5" rx="2.2" fill={BED_AMBER} />
      <rect x="12.5" y={48 - lift} width="15" height="7" rx="2" fill={BED_AMBER} />
    </>
  )
}

export function BeddiloWordmark({
  className,
  title = 'Beddilo',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 247 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d={B_PATH} />
        <path d="M48.5 44H79.5A15.5 15.5 0 1 0 72.89 56.7" />
        <circle cx="108" cy="44" r="15.5" />
        <path d="M123.5 6.5V59.5" />
        <circle cx="152" cy="44" r="15.5" />
        <path d="M167.5 6.5V59.5" />
        <path d="M182.5 28.5V59.5" />
        <path d="M197.5 6.5V59.5" />
        <circle cx="227" cy="44" r="15.5" />
      </g>
      <circle cx="182.5" cy="11" r="5.5" fill="currentColor" />
      <Bed />
    </svg>
  )
}

/**
 * The app icon: an ivory "b" on a Deep Teal rounded square (`tone="teal"`,
 * the default), or the reverse for use on dark backgrounds.
 */
export function BeddiloMark({
  className,
  tone = 'teal',
  title = 'Beddilo',
}: {
  className?: string
  tone?: 'teal' | 'ivory'
  /** Pass an empty string when the mark sits beside a visible name. */
  title?: string
}) {
  const bg = tone === 'teal' ? '#173B42' : '#F7F2E9'
  const fg = tone === 'teal' ? '#F7F2E9' : '#173B42'
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill={bg} />
      <g transform="translate(16.4 6.2) scale(0.78)">
        <path
          d={B_PATH}
          fill="none"
          stroke={fg}
          strokeWidth={ICON_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Bed lift={1} />
      </g>
    </svg>
  )
}
