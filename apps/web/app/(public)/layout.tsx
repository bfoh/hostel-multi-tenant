// Public layout — no auth, no sidebar.
// Used for the hosted booking page (/book) and future public pages.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(15,76,58,0.06) 0%, transparent 60%), #FBF4E6',
      }}
    >
      {children}
    </div>
  )
}
