export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="space-y-3">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    </div>
  )
}
