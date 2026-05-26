'use client'

/**
 * PlatformFX — Premium landing-page interactivity layer
 *
 * Attaches:
 *  • Scroll-reveal IntersectionObserver for [data-platform-reveal]
 *  • Cursor-follow glow tracking for .platform-glow-card and .platform-cta
 *  • Count-up animation for [data-platform-counter]
 *  • Magnetic pull on .platform-cta
 *  • Cleans itself up on unmount.
 *
 * Heavy work uses GPU transforms only. Respects prefers-reduced-motion.
 */

import { useEffect } from 'react'

export function PlatformFX() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ── Reveal on scroll ────────────────────────────────────────
    const revealEls = document.querySelectorAll<HTMLElement>('[data-platform-reveal]')
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const delay = Number(el.dataset.platformRevealDelay ?? 0)
            window.setTimeout(() => el.classList.add('in-view'), delay)
            revealObserver.unobserve(el)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px' },
    )
    revealEls.forEach((el) => {
      el.classList.add('platform-reveal')
      revealObserver.observe(el)
    })

    // ── Cursor-follow glow (cards + buttons) ───────────────────
    const glowEls = document.querySelectorAll<HTMLElement>('.platform-glow-card, .platform-cta')
    const handleMove = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * 100
      const my = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--mx', `${mx}%`)
      el.style.setProperty('--my', `${my}%`)
    }
    glowEls.forEach((el) => el.addEventListener('pointermove', handleMove as EventListener))

    // ── Magnetic CTA (pull button toward cursor) ───────────────
    if (!reduceMotion) {
      const magnetEls = document.querySelectorAll<HTMLElement>('[data-platform-magnetic]')
      const magnetHandlers = new Map<HTMLElement, { move: (e: PointerEvent) => void; leave: () => void }>()
      magnetEls.forEach((el) => {
        const move = (e: PointerEvent) => {
          const rect = el.getBoundingClientRect()
          const x = e.clientX - rect.left - rect.width / 2
          const y = e.clientY - rect.top - rect.height / 2
          el.style.transform = `translate(${x * 0.18}px, ${y * 0.22}px)`
        }
        const leave = () => {
          el.style.transform = ''
        }
        el.addEventListener('pointermove', move as EventListener)
        el.addEventListener('pointerleave', leave)
        magnetHandlers.set(el, { move, leave })
      })

      // ── Count-up numbers ─────────────────────────────────────
      const counterEls = document.querySelectorAll<HTMLElement>('[data-platform-counter]')
      const counterObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const el = entry.target as HTMLElement
            const target = Number(el.dataset.platformCounter ?? 0)
            const prefix = el.dataset.platformPrefix ?? ''
            const suffix = el.dataset.platformSuffix ?? ''
            const decimals = Number(el.dataset.platformDecimals ?? 0)
            const duration = Number(el.dataset.platformDuration ?? 1800)
            const start = performance.now()
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration)
              const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
              const current = target * eased
              el.textContent = `${prefix}${current.toLocaleString('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}${suffix}`
              if (t < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
            counterObserver.unobserve(el)
          })
        },
        { threshold: 0.4 },
      )
      counterEls.forEach((el) => counterObserver.observe(el))

      return () => {
        revealObserver.disconnect()
        counterObserver.disconnect()
        glowEls.forEach((el) => el.removeEventListener('pointermove', handleMove as EventListener))
        magnetHandlers.forEach((h, el) => {
          el.removeEventListener('pointermove', h.move as EventListener)
          el.removeEventListener('pointerleave', h.leave)
        })
      }
    }

    return () => {
      revealObserver.disconnect()
      glowEls.forEach((el) => el.removeEventListener('pointermove', handleMove as EventListener))
    }
  }, [])

  return null
}
