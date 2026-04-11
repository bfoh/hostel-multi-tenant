export default function OfflinePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Offline — GH Hostels</title>
        <style>{`
          body { margin: 0; font-family: system-ui, sans-serif; background: #0F0F0E; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 2rem; box-sizing: border-box; }
          h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
          p { color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-bottom: 1.5rem; }
          button { background: #2563EB; color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
          button:hover { opacity: 0.9; }
        `}</style>
      </head>
      <body>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
          <h1>You are offline</h1>
          <p>Check your internet connection and try again.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </body>
    </html>
  )
}
