import { formatGHSPrice } from '@/lib/utils'

/**
 * A rate with its billing unit, the same way everywhere on the
 * marketplace: "From GH₵5,500 / semester". Amounts are pesewas; the unit is
 * room_categories.rate_unit and is always shown, so a semester price never
 * reads as nightly.
 */
export function Price({
  amount,
  unit,
  from = false,
  size = 'md',
  className = '',
}: {
  amount: number
  unit: string | null | undefined
  from?: boolean
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <p className={`leading-tight text-bd-slate ${size === 'lg' ? 'text-[15px]' : 'text-[14px]'} ${className}`}>
      {from && <span>From </span>}
      <span className={`whitespace-nowrap font-semibold tabular-nums text-bd-ink ${size === 'lg' ? 'text-[22px] tracking-[-0.01em]' : 'text-[16px]'}`}>
        {formatGHSPrice(amount)}
      </span>
      {unit && (
        <span className="whitespace-nowrap">
          <span aria-hidden="true"> / </span>
          <span className="sr-only"> per </span>
          {unit}
        </span>
      )}
    </p>
  )
}
