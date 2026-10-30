'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '64px 24px',
          minHeight: '100vh',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#0B1F23',
          color: '#F7F2E9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.78, marginBottom: 24 }}>
            We&apos;ve been notified and are looking into it. Try again in a moment.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 22px',
              borderRadius: 999,
              border: '1px solid #F2B95A',
              background: '#F2B95A',
              color: '#173B42',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
