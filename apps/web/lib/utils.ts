import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a pesewa amount (integer) to GHS string: "GH₵ 1,250.00" */
export function formatGHS(pesewas: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(pesewas / 100)
}

/** Format a date to Ghana locale: "Mon, 08 Apr 2024" */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GH', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

/** Relative time: "2 hours ago", "in 3 days" */
export function timeAgo(date: string | Date): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diff = (new Date(date).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)

  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

/** Generate booking reference: "ABR-2024-001847" */
export function generateBookingRef(sequence: number): string {
  const year = new Date().getFullYear()
  return `ABR-${year}-${String(sequence).padStart(6, '0')}`
}

/** Truncate a string with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 1) + '…'
}

/** Initials from a full name: "Kwame Asante" → "KA" */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}
