import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { BedDouble, TrendingUp, Shield, Zap, CalendarCheck, CreditCard, Wrench, FileText } from 'lucide-react'

export const metadata: Metadata = { title: 'Sign in' }

const FEATURES = [
  { icon: BedDouble,  text: 'Real-time room & booking management' },
  { icon: TrendingUp, text: 'Revenue analytics & financial reports' },
  { icon: Shield,     text: 'ID verification & occupant security' },
  { icon: Zap,        text: 'Automated invoices, SMS & payments' },
]

const TENANT_FEATURES = [
  { icon: CalendarCheck, text: 'View your booking details and status' },
  { icon: CreditCard,    text: 'Make payments and download receipts' },
  { icon: Wrench,        text: 'Log maintenance requests from your room' },
  { icon: FileText,      text: 'Download invoices and documents' },
]

/**
 * Derive a dark version of any brand color for backgrounds.
 * Mixes the brand hue into a dark navy base so white text always works.
 */
function deriveDarkBg(hex: string): { base: string; mid: string; deep: string } {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  // Mix brand color with dark navy at different ratios
  const mix = (ratio: number) => {
    const dr = 10, dg = 22, db = 40 // dark navy base
    const mr = Math.round(dr + (r - dr) * ratio)
    const mg = Math.round(dg + (g - dg) * ratio)
    const mb = Math.round(db + (b - db) * ratio)
    return `rgb(${mr}, ${mg}, ${mb})`
  }

  return {
    base: mix(0.15), // darkest — mostly navy with brand tint
    mid:  mix(0.25), // mid — more brand showing
    deep: mix(0.08), // deepest — almost pure navy
  }
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList  = await headers()
  const tenantName   = headersList.get('x-tenant-name')
  const tenantLogo   = headersList.get('x-tenant-logo')
  const tenantColor  = headersList.get('x-tenant-color') ?? '#2563EB'
  const isTenantPage = !!tenantName

  const brandColor = tenantColor
  const darkBg     = deriveDarkBg(brandColor)

  return (
    <div className="flex min-h-[100dvh] bg-slate-50">

      {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[58%] xl:w-[62%] flex-col overflow-hidden">

        {/* Background — always dark, tinted with brand color for tenants */}
        <div
          className="absolute inset-0"
          style={isTenantPage
            ? { background: `linear-gradient(160deg, ${darkBg.mid} 0%, ${darkBg.base} 50%, ${darkBg.deep} 100%)` }
            : undefined
          }
        />
        {!isTenantPage && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B1829] via-[#0E1F3D] to-[#091424]" />
        )}

        {/* Grain texture */}
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Ambient light — brand-tinted glow */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div
            className="absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full"
            style={{
              background: `radial-gradient(circle, ${brandColor}18, transparent 70%)`,
            }}
          />
          <div
            className="absolute top-1/2 -left-48 h-[400px] w-[400px] rounded-full"
            style={{
              background: `radial-gradient(circle, ${brandColor}10, transparent 70%)`,
            }}
          />
          {/* Brand accent stripe */}
          <div
            className="absolute top-0 left-0 w-1 h-full"
            style={{ background: `linear-gradient(180deg, ${brandColor}40, transparent 60%)` }}
          />
        </div>

        <div className="relative z-10 flex h-full flex-col px-12 py-10 xl:px-16 xl:py-12">

          {/* Logo */}
          <div className="flex items-center gap-3">
            {isTenantPage && tenantLogo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tenantLogo}
                  alt={tenantName}
                  className="h-10 w-auto max-w-[160px] object-contain drop-shadow-md"
                />
              </div>
            ) : isTenantPage ? (
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl shadow-xl ring-1 ring-white/15"
                  style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}
                >
                  <span className="font-display text-lg font-bold text-white drop-shadow-sm">
                    {tenantName!.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-display text-[17px] font-bold text-white tracking-tight leading-none">
                    {tenantName}
                  </p>
                  <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/40 mt-0.5">
                    Hostel Portal
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl shadow-blue-900/50 ring-1 ring-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                    <path d="M3 11L12 3l9 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="5" y="11" width="14" height="10" rx="1" fill="white" opacity="0.15"/>
                    <rect x="7" y="13" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.9"/>
                    <rect x="13.5" y="13" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.9"/>
                    <rect x="9.5" y="17" width="5" height="4" rx="0.5" fill="white" opacity="0.95"/>
                  </svg>
                </div>
                <div>
                  <p className="font-display text-[17px] font-bold text-white tracking-tight leading-none">
                    GH Hostels
                  </p>
                  <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-blue-400/60 mt-0.5">
                    Management Platform
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Hero */}
          <div className="mt-16 xl:mt-20">
            {!isTenantPage && (
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3.5 py-1.5 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-blue-200/80 tracking-wide">
                  Built for Ghana&apos;s hostels
                </span>
              </div>
            )}

            <h1 className="font-display text-[40px] xl:text-[48px] font-extrabold text-white leading-[1.05] tracking-tight">
              {isTenantPage ? (
                <>
                  Welcome to
                  <br />
                  <span style={{ color: brandColor }} className="drop-shadow-sm">{tenantName}</span>
                </>
              ) : (
                <>
                  The smarter way
                  <br />
                  to run your{' '}
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
                      hostel
                    </span>
                    <span className="absolute -bottom-1.5 left-0 h-[3px] w-full bg-gradient-to-r from-blue-400/70 via-cyan-300/50 to-transparent rounded-full" />
                  </span>
                </>
              )}
            </h1>

            <p className="mt-6 text-[15px] text-white/50 leading-relaxed max-w-[400px]">
              {isTenantPage
                ? 'Sign in to access your booking, invoices, and manage your stay all in one place.'
                : 'From bookings and payments to housekeeping and full accounting \u2014 everything your hostel needs, elegantly unified.'}
            </p>
          </div>

          {/* Features — platform only */}
          {!isTenantPage && (
            <ul className="mt-10 space-y-3">
              {FEATURES.map(({ icon: Icon, text }, i) => (
                <li key={text} className="flex items-center gap-3.5 group" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] transition-colors duration-200 group-hover:bg-white/[0.08] group-hover:border-white/[0.12]">
                    <Icon className="h-[18px] w-[18px] text-blue-400/80" strokeWidth={1.5} />
                  </div>
                  <span className="text-[13.5px] text-white/60 font-medium">{text}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Tenant: info cards with proper icons */}
          {isTenantPage && (
            <div className="mt-10 space-y-2.5">
              {TENANT_FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.07] hover:border-white/[0.12]">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${brandColor}20` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: brandColor }} strokeWidth={1.8} />
                  </div>
                  <span className="text-[13.5px] text-white/65 font-medium">{text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stats — platform only */}
          {!isTenantPage && (
            <div className="mt-14 grid grid-cols-3 gap-3">
              {[
                { value: '500+',         label: 'Hostels managed' },
                { value: 'GH\u20B52M+',  label: 'Monthly volume' },
                { value: '99.9%',        label: 'Uptime SLA' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm">
                  <p className="font-display text-[22px] font-bold text-white/90 leading-none tracking-tight">{s.value}</p>
                  <p className="text-[11px] text-white/30 mt-1.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Testimonial — platform only */}
          {!isTenantPage && (
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-3.5 w-3.5 fill-amber-400/80" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>
              <p className="text-[13.5px] text-white/60 leading-relaxed">
                &ldquo;Managing our hostel used to take hours. Now our team handles everything from one screen &mdash; bookings, payments, housekeeping.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white ring-2 ring-white/10">KA</div>
                <div>
                  <p className="text-[13px] font-semibold text-white/80">Kwame Asante</p>
                  <p className="text-[11px] text-white/30">Manager, Unity Hall &mdash; KNUST</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-10 flex items-center justify-between">
            <p className="text-[11px] text-white/15 font-medium">
              {isTenantPage
                ? `\u00A9 ${new Date().getFullYear()} ${tenantName}. Powered by GH Hostels.`
                : `\u00A9 ${new Date().getFullYear()} GH Hostels. All rights reserved.`
              }
            </p>
            {isTenantPage && (
              <div
                className="h-1 w-12 rounded-full opacity-40"
                style={{ background: brandColor }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ──────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-[42%] xl:w-[38%]">

        {/* Mobile: show tenant logo or GH Hostels */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          {isTenantPage && tenantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantLogo} alt={tenantName!} className="h-9 w-auto max-w-[140px] object-contain" />
          ) : isTenantPage ? (
            <>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
                style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}
              >
                <span className="font-display text-base font-bold text-white">
                  {tenantName!.substring(0, 1)}
                </span>
              </div>
              <span className="font-display text-lg font-bold text-slate-900">{tenantName}</span>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M3 11L12 3l9 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="5" y="11" width="14" height="10" rx="1" fill="white" opacity="0.2"/>
                  <rect x="7" y="13" width="3.5" height="3.5" rx="0.5" fill="white"/>
                  <rect x="13.5" y="13" width="3.5" height="3.5" rx="0.5" fill="white"/>
                  <rect x="9.5" y="17" width="5" height="4" rx="0.5" fill="white"/>
                </svg>
              </div>
              <span className="font-display text-lg font-bold text-slate-900">GH Hostels</span>
            </>
          )}
        </div>

        {/* Tenant color accent bar */}
        {isTenantPage && (
          <div
            className="absolute top-0 right-0 hidden h-1 lg:block"
            style={{ width: '42%', background: `linear-gradient(90deg, ${brandColor}, ${brandColor}80)` }}
          />
        )}

        <div className="w-full max-w-[380px]">
          {children}
        </div>
      </div>

    </div>
  )
}
