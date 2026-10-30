import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Offline' }

// public/sw.js serves this page from cache when a navigation fails, so it
// may load without any JS chunks: inline styles only, and Retry is a plain
// link that reloads the URL the visitor was trying to reach.
export default function OfflinePage() {
  return (
    <div className="offline-page">
      <style>{`
        .offline-page { position: fixed; inset: 0; z-index: 50; font-family: system-ui, sans-serif; background: #0B1F23; color: #F7F2E9; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; box-sizing: border-box; }
        .offline-page h1 { color: inherit; font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; }
        .offline-page p { color: rgba(247,242,233,0.75); font-size: 0.9rem; margin: 0 0 1.5rem; }
        .offline-page a { display: inline-block; background: #F2B95A; color: #173B42; border-radius: 999px; padding: 0.6rem 1.5rem; font-size: 0.875rem; font-weight: 700; text-decoration: none; }
        .offline-page a:hover { opacity: 0.9; }
        .offline-page a:focus-visible { outline: 2px solid #F7F2E9; outline-offset: 3px; }
      `}</style>
      <div>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">📡</div>
        <h1>You are offline</h1>
        <p>Check your internet connection and try again.</p>
        <a href="">Retry</a>
      </div>
    </div>
  )
}
