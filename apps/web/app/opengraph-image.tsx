import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt =
  'GH Hostels — Hostel management software for Ghana. Bookings, MoMo, GRA accounting, payroll, one platform.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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
            'radial-gradient(circle at 20% 30%, rgba(212,162,76,0.22), transparent 55%),' +
            'radial-gradient(circle at 80% 20%, rgba(27,110,84,0.42), transparent 50%),' +
            'radial-gradient(circle at 60% 90%, rgba(245,194,107,0.16), transparent 45%),' +
            'linear-gradient(135deg, #0A0A08 0%, #0F4C3A 100%)',
          color: '#F5E9D2',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Header — logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Logo mark — inline SVG */}
          <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="14" fill="#0F4C3A" />
            <path
              d="M14 38 Q14 18 32 14 Q50 18 50 38"
              stroke="#D4A24C"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M22 42 Q22 26 32 22 Q42 26 42 42"
              stroke="#F5E9D2"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
            <rect x="22" y="42" width="20" height="2.5" rx="1.25" fill="#D4A24C" />
            <path
              d="M32 28 L33.4 32 L37.6 32 L34.2 34.6 L35.5 38.6 L32 36.2 L28.5 38.6 L29.8 34.6 L26.4 32 L30.6 32 Z"
              fill="#F5E9D2"
            />
          </svg>
          <span
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: 6,
              color: '#F5E9D2',
              fontFamily: 'sans-serif',
            }}
          >
            GH-HOSTELS
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.04,
              letterSpacing: -3.5,
              color: '#F5E9D2',
              fontFamily: 'Georgia, serif',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Run your hostel</span>
            <span style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <span>with</span>
              <span
                style={{
                  fontStyle: 'italic',
                  background:
                    'linear-gradient(135deg, #F5C26B 0%, #D4A24C 60%, #B8842E 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                  WebkitBackgroundClip: 'text',
                }}
              >
                Akwaaba.
              </span>
            </span>
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: 26,
              lineHeight: 1.4,
              color: 'rgba(245,233,210,0.72)',
              fontFamily: 'sans-serif',
              maxWidth: 880,
            }}
          >
            Bookings · MoMo payments · GRA-compliant accounting · Payroll · Occupant portal.
            Built in Ghana, for Ghana.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 28,
            borderTop: '1px solid rgba(245,233,210,0.18)',
          }}
        >
          <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
            <Pill text="Paystack MoMo" />
            <Pill text="GRA-ready" />
            <Pill text="SSNIT payroll" />
            <Pill text="Made in Accra 🇬🇭" />
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#D4A24C',
              fontFamily: 'sans-serif',
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
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
        padding: '8px 16px',
        borderRadius: 999,
        border: '1px solid rgba(212,162,76,0.45)',
        background: 'rgba(15,76,58,0.45)',
        fontSize: 18,
        color: '#F5E9D2',
        fontFamily: 'sans-serif',
        letterSpacing: 0.3,
      }}
    >
      {text}
    </div>
  )
}
