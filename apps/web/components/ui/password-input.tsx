'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** 'dark' for the auth glass theme, 'light' for normal app surfaces. */
  tone?: 'dark' | 'light'
  /** Optional override for the toggle button classes. */
  buttonClassName?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput(
    { className = '', style, tone = 'light', buttonClassName, ...rest },
    ref,
  ) {
    const [show, setShow] = useState(false)
    const Icon = show ? EyeOff : Eye

    const defaultBtn =
      tone === 'dark'
        ? 'text-bd-ivory/70 hover:text-bd-ivory focus-visible:ring-bd-amber'
        : 'text-text-secondary hover:text-text-primary focus-visible:ring-brand'

    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={`${className} pr-11`}
          style={style}
          {...rest}
        />
        {/* Focusable so keyboard and screen-reader users can reveal what
            they typed; sits after the input in tab order. */}
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-controls={rest.id}
          className={
            buttonClassName ??
            `absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 ${defaultBtn}`
          }
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    )
  },
)
