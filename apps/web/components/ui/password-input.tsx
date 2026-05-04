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
        ? 'text-[#a1a4a5] hover:text-white'
        : 'text-text-secondary hover:text-text-primary'

    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={`${className} pr-11`}
          style={style}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className={
            buttonClassName ??
            `absolute inset-y-0 right-3 flex items-center transition-colors ${defaultBtn}`
          }
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    )
  },
)
