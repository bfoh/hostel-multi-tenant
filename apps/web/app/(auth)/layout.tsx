import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { BedDouble, TrendingUp, Shield, Zap } from 'lucide-react'

export const metadata: Metadata = { title: 'Sign in' }

const FEATURES = [
  { icon: BedDouble,  text: 'Real-time room & booking management' },
  { icon: TrendingUp, text: 'Revenue analytics & financial reports' },
  { icon: Shield,     text: 'ID verification & occupant security' },
  { icon: Zap,        text: 'Automated invoices, SMS & payments' },
]

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList  = await headers()
  const tenantName   = headersList.get('x-tenant-name')
  const tenantLogo   = headersList.get('x-tenant-logo')
  const tenantColor  = headersList.get('x-tenant-color') ?? '#2563EB'
  const isTenantPage = !!tenantName

  // Derive a slightly darker shade for gradient stop
  const brandColor   = tenantColor
  const isDarkEnough = true // assume brand color works on dark bg

  return (
    <div className="flex min-h-screen bg-white">

      {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[58%] xl:w-[62%] flex-col overflow-hidden">

        {/* Background — hostel brand color when tenant, default navy for platform */}
        <div
          className="absolute inset-0"
          style={isTenantPage
            ? { background: `linear-gradient(135deg, ${brandColor}ee 0%, ${brandColor}99 50%, #0A1628 100%)` }
            : undefined
          }
        />
        {!isTenantPage && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#0F2444] to-[#0A1628]" />
        )}

        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Glow orbs */}
        <div
          className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[100px]"
          style={{ background: isTenantPage ? `${brandColor}40` : 'rgba(37,99,235,0.25)' }}
        />
        <div
          className="absolute -bottom-20 right-0 h-96 w-96 rounded-full blur-[80px]"
          style={{ background: isTenantPage ? `${brandColor}30` : 'rgba(37,99,235,0.20)' }}
        />

        <div className="relative z-10 flex h-full flex-col px-12 py-10 xl:px-16 xl:py-12">

          {/* Logo — tenant logo or GH Hostels mark */}
          <div className="flex items-center gap-3">
            {isTenantPage && tenantLogo ? (
              /* Tenant custom logo */
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tenantLogo}
                  alt={tenantName}
                  className="h-10 w-auto max-w-[160px] object-contain drop-shadow-md"
                />
              </div>
            ) : isTenantPage ? (
              /* Tenant: initials mark with brand color */
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl shadow-xl ring-1 ring-white/20"
                  style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}
                >
                  <span className="font-display text-lg font-bold text-white">
                    {tenantName!.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-display text-[17px] font-bold text-white tracking-tight leading-none">
                    {tenantName}
                  </p>
                  <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/50 mt-0.5">
                    Hostel Portal
                  </p>
                </div>
              </div>
            ) : (
              /* GH Hostels platform mark */
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

            <h1 className="font-display text-[38px] xl:text-[46px] font-bold text-white leading-[1.08] tracking-tight">
              {isTenantPage ? (
                <>
                  Welcome to
                  <br />
                  <span className="opacity-90">{tenantName}</span>
                </>
              ) : (
                <>
                  The smarter way
                  <br />
                  to run your{' '}
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                      hostel
                    </span>
                    <span className="absolute -bottom-1 left-0 h-[2px] w-full bg-gradient-to-r from-blue-400/60 to-transparent rounded-full" />
                  </span>
                </>
              )}
            </h1>

            <p className="mt-5 text-[15px] text-white/55 leading-relaxed max-w-[380px]">
              {isTenantPage
                ? 'Sign in to access your booking, invoices, and manage your stay all in one place.'
                : 'From bookings and payments to housekeeping and full accounting — everything your hostel needs, elegantly unified.'}
            </p>
          </div>

          {/* Features — only shown on platform login */}
          {!isTenantPage && (
            <ul className="mt-10 space-y-3.5">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-400/15 bg-blue-500/10 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-sm text-white/65">{text}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Tenant: simple info cards */}
          {isTenantPage && (
            <div className="mt-10 space-y-3">
              {[
                { emoji: '📋', text: 'View your booking details and status' },
                { emoji: '💳', text: 'Make payments and download receipts' },
                { emoji: '🔧', text: 'Log maintenance requests from your room' },
                { emoji: '📄', text: 'Download invoices and documents' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-sm text-white/65">{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stats — platform only */}
          {!isTenantPage && (
            <div className="mt-12 grid grid-cols-3 gap-3">
              {[
                { value: '500+',    label: 'Hostels' },
                { value: 'GH₵2M+', label: 'Monthly volume' },
                { value: '99.9%',   label: 'Uptime SLA' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm">
                  <p className="font-display text-[22px] font-bold text-white leading-none">{s.value}</p>
                  <p className="text-[11px] text-white/35 mt-1.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Testimonial — platform only */}
          {!isTenantPage && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-3.5 w-3.5 fill-amber-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>
              <p className="text-[13.5px] text-white/70 leading-relaxed italic">
                &ldquo;Managing our hostel used to take hours. Now our team handles everything from one screen — bookings, payments, housekeeping.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">KA</div>
                <div>
                  <p className="text-xs font-semibold text-white/90">Kwame Asante</p>
                  <p className="text-[11px] text-white/35">Manager, Unity Hall — KNUST</p>
                </div>
              </div>
            </div>
          )}

          <p className="mt-auto pt-10 text-[11px] text-white/20">
            {isTenantPage
              ? `© ${new Date().getFullYear()} ${tenantName}. Powered by GH Hostels.`
              : `© ${new Date().getFullYear()} GH Hostels. All rights reserved.`
            }
          </p>
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

        {/* Tenant color accent bar at top of form panel */}
        {isTenantPage && (
          <div
            className="absolute top-0 right-0 hidden h-1 lg:block"
            style={{ width: '42%', background: brandColor }}
          />
        )}

        <div className="w-full max-w-[360px]">
          {children}
        </div>
      </div>

    </div>
  )
}
