import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from '@react-pdf/renderer'

// Use ISO 4217 code (GHS) on PDFs — the U+20B5 cedi sign is not in
// any of @react-pdf's standard fonts (Helvetica/Times/Courier) and
// renders as a fallback glyph ("GHµ ..."). Plain "GHS" is the
// standard form on Ghanaian commercial invoices.
const GHS = (p: number) =>
  `GHS ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const styles = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', padding: 48 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  hostelBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  logo:        { width: 56, height: 56, objectFit: 'contain' },
  hostelName:  { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  hostelTagline:{ fontSize: 9, color: '#6b7280', marginBottom: 4 },
  hostelMeta:  { fontSize: 9, color: '#6b7280', lineHeight: 1.5 },
  invoiceTag:  { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#e5e7eb', textAlign: 'right' },
  invoiceRef:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'right', marginTop: 4 },
  invoiceDate: { fontSize: 9, color: '#9ca3af', textAlign: 'right' },
  divider:     { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 16 },
  section:     { marginBottom: 16 },
  sectionTitle:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label:       { color: '#6b7280', fontSize: 9 },
  value:       { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  tableHead:   { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '6 8', borderRadius: 4, marginBottom: 2 },
  tableRow:    { flexDirection: 'row', padding: '5 8', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  col1:        { flex: 3 },
  col2:        { flex: 1, textAlign: 'right' },
  totalBox:    { backgroundColor: '#eff6ff', borderRadius: 6, padding: 12, marginTop: 12 },
  totalLabel:  { fontSize: 10, color: '#1d4ed8' },
  totalValue:  { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  paymentRow:  { flexDirection: 'row', justifyContent: 'space-between', padding: '4 0', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  balanceDue:  { backgroundColor: '#fef2f2', borderRadius: 6, padding: 12, marginTop: 8 },
  balanceLabel:{ fontSize: 10, color: '#dc2626' },
  balanceValue:{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  footer:      { position: 'absolute', bottom: 32, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#9ca3af' },
})

interface Props {
  booking: any
  tenant: any
}

export function InvoiceDocument({ booking, tenant }: Props) {
  const occ  = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const room = Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms
  const cat  = room ? (Array.isArray(room.room_categories) ? room.room_categories[0] : room.room_categories) : null
  const payments = (Array.isArray(booking.booking_payments) ? booking.booking_payments : [])
    .filter((p: any) => p.status === 'success')
  const balance = booking.final_amount - booking.paid_amount

  const METHOD: Record<string, string> = {
    momo_mtn:        'MTN Mobile Money',
    momo_vodafone:   'Telecel Cash',
    momo_airteltigo: 'AirtelTigo Money',
    cash:            'Cash',
    bank_transfer:   'Bank Transfer',
    card:            'Card',
    cheque:          'Cheque',
  }

  function methodLabel(raw: string | null | undefined): string {
    if (!raw) return 'Payment'
    return METHOD[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const tenantAddress = [tenant?.address_line1, tenant?.address_city, tenant?.address_region]
    .filter(Boolean)
    .join(', ')
  const brandColor = tenant?.primary_color
    && /^#?[0-9a-fA-F]{6}$/.test(tenant.primary_color.replace('#', ''))
    ? (tenant.primary_color.startsWith('#') ? tenant.primary_color : `#${tenant.primary_color}`)
    : '#1d4ed8'

  return (
    <Document title={`Invoice ${booking.booking_ref}`} author={tenant?.name ?? 'GH Hostels'}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.hostelBlock}>
            {tenant?.logo_url && (
              // @react-pdf supports remote URLs for Image
              <Image src={tenant.logo_url} style={styles.logo} />
            )}
            <View>
              <Text style={[styles.hostelName, { color: brandColor }]}>
                {tenant?.name ?? 'Hostel'}
              </Text>
              {tenant?.tagline && (
                <Text style={styles.hostelTagline}>{tenant.tagline}</Text>
              )}
              <Text style={styles.hostelMeta}>
                {[tenant?.contact_phone, tenant?.contact_email, tenantAddress, tenant?.website_url]
                  .filter(Boolean)
                  .join('\n')}
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.invoiceTag}>INVOICE</Text>
            <Text style={styles.invoiceRef}>{booking.booking_ref}</Text>
            <Text style={styles.invoiceDate}>
              {new Date(booking.created_at).toLocaleDateString('en-GH', { dateStyle: 'long' })}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Occupant + Room */}
        <View style={{ flexDirection: 'row', gap: 32, marginBottom: 20 }}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            {occ && (
              <>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 }}>
                  {occ.first_name} {occ.other_names ? occ.other_names + ' ' : ''}{occ.last_name}
                </Text>
                {occ.student_id && <Text style={styles.hostelMeta}>ID: {occ.student_id}</Text>}
                {occ.institution && <Text style={styles.hostelMeta}>{occ.institution}</Text>}
                {occ.phone      && <Text style={styles.hostelMeta}>{occ.phone}</Text>}
                {occ.email      && <Text style={styles.hostelMeta}>{occ.email}</Text>}
              </>
            )}
          </View>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Stay Details</Text>
            {room && <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Room {room.room_number}{room.block ? ` · Block ${room.block}` : ''}</Text>}
            {cat  && <Text style={styles.hostelMeta}>{cat.name}</Text>}
            <Text style={styles.hostelMeta}>Check-in: {booking.check_in_date}</Text>
            <Text style={styles.hostelMeta}>Check-out: {booking.check_out_date ?? 'Ongoing'}</Text>
            {booking.semester && <Text style={styles.hostelMeta}>Semester: {booking.semester} {booking.academic_year ?? ''}</Text>}
          </View>
        </View>

        {/* Charges table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Charges</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.col1, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Description</Text>
            <Text style={[styles.col2, { fontFamily: 'Helvetica-Bold', fontSize: 9 }]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.col1}>
              Accommodation — {cat?.name ?? 'Room'} ({booking.rate_unit})
            </Text>
            <Text style={styles.col2}>{GHS(booking.total_amount)}</Text>
          </View>
          {booking.discount_amount > 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.col1, { color: '#16a34a' }]}>
                Discount{booking.discount_reason ? ` (${booking.discount_reason})` : ''}
              </Text>
              <Text style={[styles.col2, { color: '#16a34a' }]}>-{GHS(booking.discount_amount)}</Text>
            </View>
          )}
          {booking.tax_amount > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.col1}>Tax</Text>
              <Text style={styles.col2}>{GHS(booking.tax_amount)}</Text>
            </View>
          )}

          <View style={styles.totalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>{GHS(booking.final_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Payments */}
        {payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payments Received</Text>
            {payments.map((p: any, i: number) => (
              <View key={i} style={styles.paymentRow}>
                <View>
                  <Text>{methodLabel(p.method)}</Text>
                  {p.reference && (
                    <Text style={{ color: '#9ca3af', fontSize: 8 }}>
                      Ref: {p.reference}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#16a34a', fontFamily: 'Helvetica-Bold' }}>{GHS(p.amount)}</Text>
                  {p.paid_at && <Text style={{ color: '#9ca3af', fontSize: 8 }}>{new Date(p.paid_at).toLocaleDateString('en-GH')}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Balance due */}
        {balance > 0 && (
          <View style={styles.balanceDue}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={styles.balanceValue}>{GHS(balance)}</Text>
            </View>
          </View>
        )}
        {balance <= 0 && (
          <View style={{ backgroundColor: '#f0fdf4', borderRadius: 6, padding: 10, marginTop: 8 }}>
            <Text style={{ color: '#16a34a', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>PAID IN FULL</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Thank you for choosing {tenant?.name ?? 'our hostel'}. This invoice was generated automatically.</Text>
        </View>
      </Page>
    </Document>
  )
}
