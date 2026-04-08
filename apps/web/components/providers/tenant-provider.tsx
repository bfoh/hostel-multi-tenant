'use client'

import { createContext, useContext } from 'react'

interface TenantContextValue {
  tenantId: string | null
  tenantSlug: string | null
  tenantName: string | null
}

const TenantContext = createContext<TenantContextValue>({
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
})

export function TenantProvider({
  tenantId,
  tenantSlug,
  tenantName,
  children,
}: TenantContextValue & { children: React.ReactNode }) {
  return (
    <TenantContext.Provider value={{ tenantId, tenantSlug, tenantName }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
