// Public layout — no auth, no sidebar.
// Used for the hosted booking page (/book) and future public pages.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {children}
    </div>
  )
}
