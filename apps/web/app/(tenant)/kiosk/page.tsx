import type { Metadata } from 'next'
import { KioskClient } from '@/components/kiosk/kiosk-client'

export const metadata: Metadata = { title: 'Reception Kiosk' }

export default function KioskPage() {
  return <KioskClient />
}
