import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="space-y-2">
        <p className="font-mono text-sm font-medium text-text-tertiary">404</p>
        <h1 className="font-display text-3xl font-bold text-text-primary">Page not found</h1>
        <p className="max-w-sm text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
