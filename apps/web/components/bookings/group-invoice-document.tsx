import {
  Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer'

const GHS = (p: number) =>
  `GHS ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const styles = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', padding: 48 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  hostelBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  logo:        { width: 56, height: 56, objectFit: 'contain' },
  hostelName:  { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  hostelMeta:  { fontSize: 9, color: '#6b7280', lineHeight: 1.5 },
  invoiceTag:  { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#e5e7eb', textAlign: 'right' },
  invoiceRef:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'right', marginTop: 4 },
  invoiceDate: { fontSize: 9, color: '#9ca3af', textAlign: 'right' },
  divider:     { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 16 },
  section:     { marginBottom: 16 },
  sectionTitle:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  tableHead:   { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '6 8', borderRadius: 4, marginBottom: 2 },
  tableRow:    { flexDirection: 'row', padding: '5 8', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  colRoom:     { flex: 2 },
  colGuest:    { flex: 2 },
  colAmt:      { flex: 1, textAlign: 'right' },
  totalBox:    { backgroundColor: '#eff6ff', borderRadius: 6, padding: 12, marginTop: 12 },
  totalLabel:  { fontSize: 10, color: '#1d4ed8' },
  totalValue:  { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  balanceDue:  { backgroundColor: '#fef2f2', borderRadius: 6, padding: 12, marginTop: 8 },
  balanceLabel:{ fontSize: 10, color: '#dc2626' },
  balanceValue:{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  footer:      { position: 'absolute', bottom: 32, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#9ca3af' },
})

interface RoomLine {
  bookingRef: string
  roomNumber: string | null
  guestName:  string
  totalAmount: number
  finalAmount: number
  paidAmount: number
}

interface Props {
  group:  { group_ref: string; billing_contact_name: string | null; billing_contact_email: string | null; billing_contact_phone: string | null; created_at: string }
  rooms:  RoomLine[]
  tenant: any
}

/**
 * Combined invoice for a group booking — one row per room, each room's own
 * payment/discount already reflected in its final_amount/paid_amount
 * (independent per-room billing, see booking_groups migration comment).
 * This document is purely a combined view for convenience.
 */
export function GroupInvoiceDocument({ group, rooms, tenant }: Props) {
  const grandTotal = rooms.reduce((s, r) => s + r.finalAmount, 0)
  const grandPaid  = rooms.reduce((s, r) => s + r.paidAmount, 0)
  const balance    = grandTotal - grandPaid

  const tenantAddress = [tenant?.address_line1, tenant?.address_city, tenant?.address_region]
    .filter(Boolean)
    .join(', ')
  const brandColor = tenant?.primary_color
    && /^#?[0-9a-fA-F]{6}$/.test(tenant.primary_color.replace('#', ''))
    ? (tenant.primary_color.startsWith('#') ? tenant.primary_color : `#${tenant.primary_color}`)
    : '#1d4ed8'

  return (
    <Document title={`Group Invoice ${group.group_ref}`} author={tenant?.name ?? 'Hotel'}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.hostelBlock}>
            {tenant?.logo_url && <Image src={tenant.logo_url} style={styles.logo} />}
            <View>
              <Text style={[styles.hostelName, { color: brandColor }]}>{tenant?.name ?? 'Hotel'}</Text>
              <Text style={styles.hostelMeta}>
                {[tenant?.contact_phone, tenant?.contact_email, tenantAddress].filter(Boolean).join('\n')}
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.invoiceTag}>GROUP INVOICE</Text>
            <Text style={styles.invoiceRef}>{group.group_ref}</Text>
            <Text style={styles.invoiceDate}>
              {new Date(group.created_at).toLocaleDateString('en-GH', { dateStyle: 'long' })}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Contact</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 }}>
            {group.billing_contact_name ?? 'Group Organizer'}
          </Text>
          {group.billing_contact_phone && <Text style={styles.hostelMeta}>{group.billing_contact_phone}</Text>}
          {group.billing_contact_email && <Text style={styles.hostelMeta}>{group.billing_contact_email}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rooms ({rooms.length})</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.colRoom, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Room</Text>
            <Text style={[styles.colGuest, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Guest</Text>
            <Text style={[styles.colAmt, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Total</Text>
            <Text style={[styles.colAmt, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Paid</Text>
          </View>
          {rooms.map((r) => (
            <View key={r.bookingRef} style={styles.tableRow}>
              <Text style={styles.colRoom}>{r.roomNumber ? `Room ${r.roomNumber}` : '—'} ({r.bookingRef})</Text>
              <Text style={styles.colGuest}>{r.guestName}</Text>
              <Text style={styles.colAmt}>{GHS(r.finalAmount)}</Text>
              <Text style={styles.colAmt}>{GHS(r.paidAmount)}</Text>
            </View>
          ))}

          <View style={styles.totalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.totalLabel}>Group Total</Text>
              <Text style={styles.totalValue}>{GHS(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {balance > 0 ? (
          <View style={styles.balanceDue}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={styles.balanceValue}>{GHS(balance)}</Text>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: '#f0fdf4', borderRadius: 6, padding: 10, marginTop: 8 }}>
            <Text style={{ color: '#16a34a', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>PAID IN FULL</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Thank you for choosing {tenant?.name ?? 'our hotel'}. This invoice was generated automatically.</Text>
        </View>
      </Page>
    </Document>
  )
}
