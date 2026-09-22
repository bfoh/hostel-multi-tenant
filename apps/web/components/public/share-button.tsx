'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { MP } from '@/lib/marketplace-theme'

/**
 * Uses the native share sheet where available (mobile browsers, the
 * Capacitor app), falling back to copying the link — never a dead button.
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // User cancelled the share sheet — not an error worth surfacing.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked — silently no-op rather than throw in the UI.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-neutral-50 ${className ?? ''}`}
      style={{ border: `1px solid ${MP.border}`, color: copied ? MP.green : MP.textSecondary }}
      aria-label={copied ? 'Link copied' : 'Share this hostel'}
      title={copied ? 'Link copied' : 'Share'}
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
    </button>
  )
}
