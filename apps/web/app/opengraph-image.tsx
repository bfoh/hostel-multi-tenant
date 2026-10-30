import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt =
  'Beddilo — a world of stays. Find your stay. Feel at home. Hotels, student hostels and apartments in one place.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TEAL = '#173B42'
const IVORY = '#F7F2E9'
const AMBER = '#F2B95A'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background:
            'radial-gradient(circle at 88% 0%, rgba(242,185,90,0.28), transparent 50%),' +
            'radial-gradient(circle at 0% 100%, rgba(234,128,107,0.24), transparent 55%),' +
            `linear-gradient(160deg, #1E4950 0%, ${TEAL} 50%, #0B1F23 100%)`,
          color: IVORY,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Wordmark — same geometry as components/brand/beddilo-logo.tsx */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <svg width="309" height="80" viewBox="0 0 247 64" fill="none">
            <g stroke={IVORY} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 6.5V59.5H29.5Q35.5 59.5 35.5 53.5V44A15.5 15.5 0 0 0 4.5 44" />
              <path d="M48.5 44H79.5A15.5 15.5 0 1 0 72.89 56.7" />
              <circle cx="108" cy="44" r="15.5" />
              <path d="M123.5 6.5V59.5" />
              <circle cx="152" cy="44" r="15.5" />
              <path d="M167.5 6.5V59.5" />
              <path d="M182.5 28.5V59.5" />
              <path d="M197.5 6.5V59.5" />
              <circle cx="227" cy="44" r="15.5" />
            </g>
            <circle cx="182.5" cy="11" r="5.5" fill={IVORY} />
            <rect x="14" y="41.5" width="12" height="4.5" rx="2.2" fill={AMBER} />
            <rect x="12.5" y="48" width="15" height="7" rx="2" fill={AMBER} />
          </svg>
          <div style={{ display: 'flex', fontSize: 20, letterSpacing: 8, color: AMBER, fontWeight: 600 }}>
            A WORLD OF STAYS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 80, lineHeight: 1.05, letterSpacing: -2, fontWeight: 700 }}>
            Find your stay. Feel at home.
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontSize: 28,
              lineHeight: 1.4,
              color: 'rgba(247,242,233,0.78)',
              maxWidth: 900,
            }}
          >
            Discover hotels, student hostels, apartments and beautiful getaways — all in one place.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 28,
            borderTop: '1px solid rgba(247,242,233,0.18)',
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Pill text="Hotels" />
            <Pill text="Student hostels" />
            <Pill text="Apartments" />
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: AMBER, letterSpacing: 2, fontWeight: 600 }}>
            gh-hostels.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}

function Pill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 18px',
        borderRadius: 999,
        border: '1px solid rgba(242,185,90,0.5)',
        background: 'rgba(11,31,35,0.45)',
        fontSize: 20,
        color: IVORY,
      }}
    >
      {text}
    </div>
  )
}
