import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes safely, resolving conflicts.
 * Use everywhere instead of template literals.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
