/**
 * Beddilo design tokens for the public marketplace surfaces — the homepage
 * (app/page.tsx), /browse, /listing/[slug], /list-your-property and
 * /for-owners. Single source of truth for inline-styled values; the same
 * palette is exposed to Tailwind as `bd-*` (tailwind.config.ts) and to CSS
 * as `--bd-*` (app/globals.css), which is what to reach for when an
 * element needs hover/focus states.
 *
 * Fixed platform identity — never tenant-overridable. Tenant-branded
 * surfaces (dashboards, tenant booking pages) theme through --color-brand.
 *
 * Contrast: `accent` (Sunny Amber) and `coral` are too light for text on
 * ivory/white — use `accentText` / `coralText` for text and small icons,
 * and Deep Teal (never white) for text on an amber fill.
 */

export const BEDDILO = {
  teal:      '#173B42',
  tealDeep:  '#102C31',
  tealSoft:  '#2A5A61',
  ivory:     '#F7F2E9',
  amber:     '#F2B95A',
  coral:     '#EA806B',
} as const

export const MP = {
  bg:            BEDDILO.ivory,
  surface:       '#FFFFFF',
  surfaceSoft:   '#EFE7D8',
  border:        'rgba(23, 59, 66, 0.12)',
  borderStrong:  'rgba(23, 59, 66, 0.22)',
  ink:           BEDDILO.teal,
  textSecondary: '#52646A',
  /** Primary actions, links and active states. */
  primary:       BEDDILO.teal,
  primaryHover:  BEDDILO.tealDeep,
  primarySoft:   BEDDILO.tealSoft,
  /** Highlight fills — CTAs on dark, badges, chips. Pair with teal text. */
  accent:        BEDDILO.amber,
  accentSoft:    '#F7D08F',
  /** Amber dark enough for text/icons on ivory or white (≈5.3:1). */
  accentText:    '#8A5A10',
  coral:         BEDDILO.coral,
  /** Coral dark enough for text/icons on ivory or white (≈5.3:1). */
  coralText:     '#A8452F',
} as const
