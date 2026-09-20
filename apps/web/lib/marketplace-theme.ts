/**
 * Shared design tokens for the public marketplace surfaces — the homepage
 * (app/page.tsx), /hostels, /hostels/[slug], and /for-owners. Single source
 * of truth, replacing three previously-divergent palettes (a dark ink theme
 * on the homepage/for-owners, and a separate Booking.com-literal navy/blue
 * theme on /hostels and /hostels/[slug]).
 *
 * Light mode: warm cream base, green + gold accents, Adinkra collage
 * background (see .platform-adinkra-bg-light in globals.css).
 */

export const MP = {
  bg:            '#FBF8F2',
  surface:       '#FFFFFF',
  surfaceSoft:   '#F3EEE2',
  border:        'rgba(27, 110, 84, 0.14)',
  borderStrong:  'rgba(27, 110, 84, 0.22)',
  ink:           '#14231D',
  textSecondary: '#5B6660',
  green:         '#2F7D57',
  greenDeep:     '#1B6E54',
  gold:          '#D4A24C',
  goldSoft:      '#F5C26B',
  goldDeep:      '#B8842E',
} as const
