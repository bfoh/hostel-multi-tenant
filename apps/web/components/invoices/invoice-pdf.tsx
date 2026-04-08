import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from '@react-pdf/renderer'

/* ── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  page: {
    fontFamily:    'Helvetica',
    fontSize:      10,
    color:         '#1a202c',
    paddingTop:    48,
    paddingBottom: 48,
    paddingHorizontal: 52,
    backgroundColor: '#ffffff',
  },

  /* Header */
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  logo:   { width: 56, height: 56, objectFit: 'contain' },
  logoPlaceholder: {
    width: 56, height: 56,
    backgroundColor: '#1B4F72',
    borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  logoLetter: { color: '#ffffff', fontSize: 24, fontFamily: 'Helvetica-Bold' },
  hostelName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1B4F72' },
  hostelSub:  { fontSize: 9, color: '#718096', marginTop: 2 },
  invoiceTag: { textAlign: 'right' },
  invoiceLabel: { fontSize: 9, color: '#718096', textTransform: 'uppercase', letterSpacing: 1 },
  invoiceRef:   { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  invoiceDate:  { fontSize: 9, color: '#718096', marginTop: 2 },

  /* Status badge */
  badge: { marginTop: 6, alignSelf: 'flex-end', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'capitalize' },

  divider: { borderBottom: '1pt solid #e2e8f0', marginVertical: 20 },

  /* Bill-to / Room grid */
  grid2: { flexDirection: 'row', gap: 24 },
  col:   { flex: 1 },
  sectionLabel: { fontSize: 8, color: '#718096', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  boldText: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  mutedText: { color: '#718096', marginTop: 1 },

  /* Line items */
  table: { marginTop: 28 },
  tableHeader: { flexDirection: 'row', borderBottom: '1pt solid #e2e8f0', paddingBottom: 6, marginBottom: 4 },
  tableHeaderCell: { fontSize: 8, color: '#718096', textTransform: 'uppercase', letterSpacing: 0.8 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottom: '0.5pt solid #f0f0f0' },
  colDesc:   { flex: 1 },
  colAmount: { width: 80, textAlign: 'right' },

  /* Totals */
  totals: { marginTop: 12, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
  totalLabel: { width: 140, textAlign: 'right', color: '#718096' },
  totalValue: { width: 80, textAlign: 'right' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, paddingTop: 6, borderTop: '1.5pt solid #1a202c' },
  grandTotalLabel: { width: 140, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  grandTotalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  balanceLabel: { width: 140, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#e53e3e' },
  balanceValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#e53e3e' },

  /* Payment history */
  paymentSection: { marginTop: 28, paddingTop: 16, borderTop: '1pt solid #e2e8f0' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },

  /* Footer */
  footer: { position: 'absolute', bottom: 32, left: 52, right: 52, textAlign: 'center' },
  footerText: { fontSize: 8, color: '#a0aec0' },
})

/* ── Helpers ─────────────────────────────────────────────────────────── */

function formatGHS(pesewas: number) {
  return `GH₵ ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
}

const METHOD_LABEL: Record<string, string> = {
  momo_mtn: 'MTN MoMo', momo_vodafone: 'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money', cash: 'Cash',
  bank_transfer: 'Bank Transfer', card: 'Card', cheque: 'Cheque',
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  unpaid:  { bg: '#FFF5F5', text: '#e53e3e' },
  partial: { bg: '#FFFAF0', text: '#d69e2e' },
  paid:    { bg: '#F0FFF4', text: '#276749' },
  refunded:{ bg: '#F7FAFC', text: '#718096' },
}

/* ── Props ────────────────────────────────────────────────────────────── */

export interface InvoicePDFProps {
  inv: {
    booking_ref: string
    created_at: string
    payment_status: string
    check_in_date: string
    check_out_date: string
    semester: string | null
    total_amount: number
    discount_amount: number
    discount_reason: string | null
    tax_amount: number
    final_amount: number
    paid_amount: number
  }
  occupant: {
    first_name: string
    last_name: string
    other_names?: string | null
    student_id?: string | null
    institution?: string | null
    programme?: string | null
    phone?: string | null
    email?: string | null
  } | null
  room: {
    room_number: string
    block?: string | null
    floor?: number | null
  } | null
  categoryName: string
  payments: {
    id: string
    amount: number
    method: string
    reference?: string | null
    paid_at?: string | null
  }[]
  hostelName: string
  hostelTagline?: string | null
  hostelAddress?: string | null
  hostelPhone?: string | null
  hostelEmail?: string | null
  logoUrl?: string | null
}

/* ── PDF Document ─────────────────────────────────────────────────────── */

export function InvoicePDF({
  inv, occupant, room, categoryName, payments,
  hostelName, hostelTagline, hostelAddress, hostelPhone, hostelEmail, logoUrl,
}: InvoicePDFProps) {
  const balance  = Math.max(0, inv.final_amount - inv.paid_amount)
  const badge    = BADGE_COLORS[inv.payment_status] ?? { bg: '#F7FAFC', text: '#718096' }
  const successPayments = payments.filter((p) => p.paid_at)

  return (
    <Document title={`Invoice ${inv.booking_ref}`} author={hostelName}>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            {/* Logo or initial */}
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoLetter}>{hostelName.charAt(0)}</Text>
              </View>
            )}
            <Text style={[styles.hostelName, { marginTop: 8 }]}>{hostelName}</Text>
            {hostelTagline  && <Text style={styles.hostelSub}>{hostelTagline}</Text>}
            {hostelAddress  && <Text style={styles.hostelSub}>{hostelAddress}</Text>}
            {hostelPhone    && <Text style={styles.hostelSub}>{hostelPhone}</Text>}
            {hostelEmail    && <Text style={styles.hostelSub}>{hostelEmail}</Text>}
          </View>

          <View style={styles.invoiceTag}>
            <Text style={styles.invoiceLabel}>Invoice</Text>
            <Text style={styles.invoiceRef}>{inv.booking_ref}</Text>
            <Text style={styles.invoiceDate}>Issued: {formatDate(inv.created_at)}</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>{inv.payment_status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Bill to + Room details ── */}
        <View style={styles.grid2}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.boldText}>
              {occupant?.first_name} {occupant?.last_name}
              {occupant?.other_names ? ` ${occupant.other_names}` : ''}
            </Text>
            {occupant?.student_id  && <Text style={styles.mutedText}>ID: {occupant.student_id}</Text>}
            {occupant?.institution && <Text style={styles.mutedText}>{occupant.institution}</Text>}
            {occupant?.programme   && <Text style={styles.mutedText}>{occupant.programme}</Text>}
            {occupant?.phone       && <Text style={styles.mutedText}>{occupant.phone}</Text>}
            {occupant?.email       && <Text style={styles.mutedText}>{occupant.email}</Text>}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Room Details</Text>
            <Text style={styles.boldText}>
              Room {room?.room_number}
              {room?.block ? ` — Block ${room.block}` : ''}
              {room?.floor != null ? `, Floor ${room.floor}` : ''}
            </Text>
            <Text style={styles.mutedText}>{categoryName}</Text>
            <Text style={[styles.mutedText, { marginTop: 4 }]}>
              Check-in:  {formatDate(inv.check_in_date)}
            </Text>
            <Text style={styles.mutedText}>
              Check-out: {formatDate(inv.check_out_date)}
            </Text>
            {inv.semester && <Text style={styles.mutedText}>Semester: {inv.semester}</Text>}
          </View>
        </View>

        {/* ── Line items ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>

          {/* Accommodation row */}
          <View style={styles.tableRow}>
            <View style={styles.colDesc}>
              <Text>Room accommodation — {categoryName}</Text>
              <Text style={{ fontSize: 8, color: '#718096', marginTop: 2 }}>
                {formatDate(inv.check_in_date)} → {formatDate(inv.check_out_date)}
              </Text>
            </View>
            <Text style={styles.colAmount}>{formatGHS(inv.total_amount)}</Text>
          </View>

          {/* Discount */}
          {inv.discount_amount > 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.colDesc, { color: '#718096' }]}>
                Discount{inv.discount_reason ? ` — ${inv.discount_reason}` : ''}
              </Text>
              <Text style={[styles.colAmount, { color: '#276749' }]}>−{formatGHS(inv.discount_amount)}</Text>
            </View>
          )}

          {/* Tax */}
          {inv.tax_amount > 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.colDesc, { color: '#718096' }]}>Tax (VAT/NHIL/GETFund)</Text>
              <Text style={styles.colAmount}>{formatGHS(inv.tax_amount)}</Text>
            </View>
          )}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totals}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatGHS(inv.final_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: '#276749' }]}>Amount paid</Text>
            <Text style={[styles.totalValue, { color: '#276749' }]}>{formatGHS(inv.paid_amount)}</Text>
          </View>
          {balance > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.balanceLabel}>Balance due</Text>
              <Text style={styles.balanceValue}>{formatGHS(balance)}</Text>
            </View>
          )}
        </View>

        {/* ── Payment history ── */}
        {successPayments.length > 0 && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionLabel}>Payment History</Text>
            {successPayments.map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <Text style={{ color: '#718096' }}>{p.paid_at ? formatDate(p.paid_at) : '—'}</Text>
                <Text>{METHOD_LABEL[p.method] ?? p.method}</Text>
                {p.reference && <Text style={{ color: '#718096', fontSize: 8 }}>Ref: {p.reference}</Text>}
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#276749' }}>{formatGHS(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for choosing {hostelName}.
          </Text>
          <Text style={[styles.footerText, { marginTop: 2 }]}>
            This is a computer-generated invoice and does not require a signature.
          </Text>
        </View>

      </Page>
    </Document>
  )
}
