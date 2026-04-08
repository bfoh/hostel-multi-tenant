import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'

// Adinkra Design System — Tailwind Configuration
// All color values are HSL components fed from CSS variables.
// This allows tenant themes to override colors without touching this file.

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],

  theme: {
    // Override default Tailwind border radius with Adinkra scale
    borderRadius: {
      none: '0px',
      xs: '2px',
      sm: '4px',
      DEFAULT: '6px',
      md: '6px',
      lg: '8px',
      xl: '12px',
      '2xl': '16px',
      '3xl': '24px',
      full: '9999px',
    },

    extend: {
      // ── COLORS (all read from CSS custom properties) ────────────
      colors: {
        // Brand — Volta Blue (overridable per tenant)
        brand: {
          DEFAULT: 'hsl(var(--color-brand))',
          hover: 'hsl(var(--color-brand-hover))',
          active: 'hsl(var(--color-brand-active))',
          subtle: 'hsl(var(--color-brand-subtle))',
          'subtle-hover': 'hsl(var(--color-brand-subtle-hover))',
          fg: 'hsl(var(--color-brand-fg))',
        },
        // Accent — Kente Gold (overridable per tenant)
        accent: {
          DEFAULT: 'hsl(var(--color-accent))',
          hover: 'hsl(var(--color-accent-hover))',
          subtle: 'hsl(var(--color-accent-subtle))',
          fg: 'hsl(var(--color-accent-fg))',
        },
        // Semantic status (fixed — do not override per tenant)
        success: {
          DEFAULT: 'hsl(var(--color-success))',
          subtle: 'hsl(var(--color-success-subtle))',
          fg: 'hsl(var(--color-success-fg))',
        },
        danger: {
          DEFAULT: 'hsl(var(--color-danger))',
          hover: 'hsl(var(--color-danger-hover))',
          subtle: 'hsl(var(--color-danger-subtle))',
          fg: 'hsl(var(--color-danger-fg))',
        },
        warning: {
          DEFAULT: 'hsl(var(--color-warning))',
          subtle: 'hsl(var(--color-warning-subtle))',
          fg: 'hsl(var(--color-warning-fg))',
        },
        info: {
          DEFAULT: 'hsl(var(--color-info))',
          subtle: 'hsl(var(--color-info-subtle))',
          fg: 'hsl(var(--color-info-fg))',
        },
        // Surfaces
        surface: {
          DEFAULT: 'hsl(var(--color-surface))',
          raised: 'hsl(var(--color-surface-raised))',
          sunken: 'hsl(var(--color-surface-sunken))',
        },
        // Text
        text: {
          primary: 'hsl(var(--color-text-primary))',
          secondary: 'hsl(var(--color-text-secondary))',
          tertiary: 'hsl(var(--color-text-tertiary))',
          disabled: 'hsl(var(--color-text-disabled))',
          inverse: 'hsl(var(--color-text-inverse))',
        },
        // Borders
        border: {
          DEFAULT: 'hsl(var(--color-border))',
          muted: 'hsl(var(--color-border-muted))',
          strong: 'hsl(var(--color-border-strong))',
        },
        // Sidebar — ALWAYS dark, never overridden by tenant
        sidebar: {
          bg: 'hsl(var(--color-sidebar-bg))',
          text: 'hsl(var(--color-sidebar-text))',
          'text-active': 'hsl(var(--color-sidebar-text-active))',
          'item-active': 'hsl(var(--color-sidebar-item-active))',
          'item-hover': 'hsl(var(--color-sidebar-item-hover))',
        },
        // Background
        background: 'hsl(var(--color-bg))',
      },

      // ── FONTS ───────────────────────────────────────────────────
      fontFamily: {
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'sans-serif'],
        sans: ['var(--font-sans)', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },

      // ── TYPE SCALE ──────────────────────────────────────────────
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.03em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.04em' }],
        '5xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.05em' }],
        '6xl': ['3.75rem', { lineHeight: '4rem', letterSpacing: '-0.06em' }],
      },

      // ── SHADOWS ─────────────────────────────────────────────────
      boxShadow: {
        xs: '0 1px 2px rgba(15, 20, 30, 0.06)',
        sm: '0 1px 3px rgba(15, 20, 30, 0.08), 0 1px 2px rgba(15, 20, 30, 0.06)',
        md: '0 4px 8px rgba(15, 20, 30, 0.08), 0 2px 4px rgba(15, 20, 30, 0.05)',
        lg: '0 10px 20px rgba(15, 20, 30, 0.10), 0 4px 8px rgba(15, 20, 30, 0.06)',
        xl: '0 20px 40px rgba(15, 20, 30, 0.12), 0 8px 16px rgba(15, 20, 30, 0.06)',
        focus: '0 0 0 3px hsl(var(--color-brand) / 0.25)',
        'focus-danger': '0 0 0 3px hsl(var(--color-danger) / 0.25)',
      },

      // ── SPACING (extends Tailwind default) ───────────────────────
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '22': '5.5rem',
        sidebar: '17.5rem',        // 280px expanded sidebar
        'sidebar-collapsed': '4.5rem', // 72px collapsed sidebar
      },

      // ── TRANSITIONS ─────────────────────────────────────────────
      transitionDuration: {
        micro: '75ms',
        fast: '150ms',
        base: '200ms',
        smooth: '300ms',
        slow: '400ms',
      },

      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        enter: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
        exit: 'cubic-bezier(0.4, 0.0, 1, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // ── KEYFRAME ANIMATIONS ─────────────────────────────────────
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUpFade: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 200ms var(--ease-enter) forwards',
        'slide-in-right': 'slideInRight 300ms var(--ease-enter) forwards',
        'slide-out-right': 'slideOutRight 300ms var(--ease-exit) forwards',
        'scale-in': 'scaleIn 200ms var(--ease-enter) forwards',
        'slide-up-fade': 'slideUpFade 200ms var(--ease-enter) forwards',
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      // ── SCREEN BREAKPOINTS ──────────────────────────────────────
      screens: {
        xs: '480px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },

  plugins: [animatePlugin],
}

export default config
