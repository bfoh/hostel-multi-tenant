'use client'

/**
 * Minimal toast system using CSS transitions.
 * For a production app, replace with sonner or react-hot-toast.
 * Keeping it dependency-free for now.
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

// Simple global toast store
let toastListeners: ((toasts: Toast[]) => void)[] = []
let currentToasts: Toast[] = []

function notifyListeners() {
  toastListeners.forEach((l) => l([...currentToasts]))
}

export function toast(message: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  const t = { ...message, id }
  currentToasts = [...currentToasts, t]
  notifyListeners()

  setTimeout(() => {
    currentToasts = currentToasts.filter((x) => x.id !== id)
    notifyListeners()
  }, 4000)
}

toast.success = (title: string, description?: string) =>
  toast({ type: 'success', title, description })
toast.error = (title: string, description?: string) =>
  toast({ type: 'error', title, description })
toast.warning = (title: string, description?: string) =>
  toast({ type: 'warning', title, description })
toast.info = (title: string, description?: string) =>
  toast({ type: 'info', title, description })

const typeStyles: Record<ToastType, string> = {
  success: 'border-l-success bg-success-subtle text-success',
  error:   'border-l-danger  bg-danger-subtle  text-danger',
  warning: 'border-l-warning bg-warning-subtle text-warning-fg',
  info:    'border-l-info    bg-info-subtle    text-info',
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (t: Toast[]) => setToasts(t)
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex w-80 flex-col gap-0.5 rounded-lg border-l-4 px-4 py-3 shadow-lg',
            'animate-slide-up-fade bg-surface',
            typeStyles[t.type]
          )}
        >
          <p className="text-sm font-medium">{t.title}</p>
          {t.description && (
            <p className="text-xs opacity-80">{t.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
