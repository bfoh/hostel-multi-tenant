import {
  Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer'
import { splitGhanaTax } from '@/lib/tax/ghana'

/* ── Styles ─────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a202c',
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 50,
    backgroundColor: '#ffffff',
  },

  /* Header */
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo: { width: 52, height: 52, objectFit: 'contain' },
  logoBox: {
    width: 52, height: 52,
    backgroundColor: '#1B4F72', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  logoLetter: { color: '#fff', fontSize: 22, fontFamily: 'Helvetica-Bold' },
  hostelName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1B4F72', marginTop: 8 },
  hostelSub: { fontSize: 8.5, color: '#718096', marginTop: 1.5 },
  tinText: { fontSize: 8, color: '#a0aec0', marginTop: 3 },

  invoiceTag: { textAlign: 'right' },
  invoiceType: { fontSize: 8, color: '#718096', textTransform: 'uppercase', letterSpacing: 1.2 },
  invoiceRef: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  invoiceDate: { fontSize: 8.5, color: '#718096', marginTop: 2 },
  badge: { marginTop: 6, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-end' },
  badgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'capitalize' },

  divider: { borderBottom: '1pt solid #e2e8f0', marginVertical: 18 },
  thinDivider: { borderBottom: '0.5pt solid #f0f0f0', marginVertical: 4 },

  /* Bill to / Room grid */
  grid2: { flexDirection: 'row', gap: 24 },
  col: { flex: 1 },
  sectionLabel: {
    fontSize: 7.5, color: '#a0aec0',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 5,
  },
  bold: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  muted: { color: '#718096', fontSize: 9, marginTop: 1.5 },

  /* Line items */
  table: { marginTop: 24 },
  tableHeader: { flexDirection: 'row', borderBottom: '1pt solid #e2e8f0', paddingBottom: 5, marginBottom: 2 },
  tableHeaderCell: { fontSize: 7.5, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 0.8 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottom: '0.5pt solid #f0f0f0' },
  colDesc: { flex: 1 },
  colAmt: { width: 88, textAlign: 'right' },

  /* Tax breakdown box */
  taxBox: {
    marginTop: 16,
    marginLeft: 'auto',
    width: 240,
    backgroundColor: '#f7fafc',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeft: '3pt solid #e2e8f0',
  },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  taxLabel: { color: '#718096', fontSize: 9 },
  taxValue: { fontSize: 9 },
  taxSeparator: { borderBottom: '0.5pt solid #e2e8f0', marginVertical: 4 },

  /* Totals */
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  totalLabel: { width: 150, textAlign: 'right', color: '#718096' },
  totalValue: { width: 88, textAlign: 'right' },
  grandLabel: { width: 150, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  grandValue: { width: 88, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  balanceLabel: { width: 150, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#e53e3e' },
  balanceValue: { width: 88, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#e53e3e' },

  /* Payment history */
  pmtSection: { marginTop: 24, paddingTop: 14, borderTop: '1pt solid #e2e8f0' },
  pmtRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, fontSize: 9 },

  /* GRA compliance */
  graBox: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f7fafc',
    borderRadius: 6,
    borderLeft: '2pt solid #bee3f8',
  },
  graText: { fontSize: 8, color: '#4a5568', lineHeight: 1.6 },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 28, left: 50, right: 50,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7.5, color: '#a0aec0',
    borderTop: '0.5pt solid #e2e8f0', paddingTop: 6,
  },
})

/* ── Helpers ──────────────────────────────────────────────────────────── */

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dt(d: string) {
  return new Date(d).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
}

const METHOD: Record<string, string> = {
  momo_mtn: 'MTN MoMo', momo_vodafone: 'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money', cash: 'Cash',
  bank_transfer: 'Bank Transfer', card: 'Card', cheque: 'Cheque',
}

const BADGE: Record<string, { bg: string; text: string }> = {
  unpaid:  { bg: '#FFF5F5', text: '#e53e3e' },
  partial: { bg: '#FFFAF0', text: '#d69e2e' },
  paid:    { bg: '#F0FFF4', text: '#276749' },
  refunded:{ bg: '#F7FAFC', text: '#718096' },
}

/* ── Props ───────────────────────────────────────────────────────────── */

export interface InvoicePDFProps {
  inv: {
    booking_ref:    string
    invoice_number: string | null
    created_at:     string
    payment_status: string
    check_in_date:  string
    check_out_date: string
    semester:       string | null
    total_amount:   number
    discount_amount:number
    discount_reason:string | null
    tax_amount:     number
    vat_amount:     number
    nhil_amount:    number
    getfund_amount: number
    final_amount:   number
    paid_amount:    number
  }
  occupant: {
    first_name: string; last_name: string; other_names?: string | null
    student_id?: string | null; institution?: string | null
    programme?: string | null; phone?: string | null; email?: string | null
  } | null
  room: { room_number: string; block?: string | null; floor?: number | null } | null
  categoryName:  string
  payments: { id: string; amount: number; method: string; reference?: string | null; paid_at?: string | null }[]
  hostelName:    string
  hostelTagline?: string | null
  hostelAddress?: string | null
  hostelPhone?:   string | null
  hostelEmail?:   string | null
  logoUrl?:       string | null
  tin?:           string | null
  vatRegNumber?:  string | null
  isVatRegistered?: boolean
}

/* ── Document ─────────────────────────────────────────────────────────── */

export function InvoicePDF({
  inv, occupant, room, categoryName, payments,
  hostelName, hostelTagline, hostelAddress, hostelPhone, hostelEmail, logoUrl,
  tin, vatRegNumber, isVatRegistered,
}: InvoicePDFProps) {
  const balance         = Math.max(0, inv.final_amount - inv.paid_amount)
  const badge           = BADGE[inv.payment_status] ?? { bg: '#F7FAFC', text: '#718096' }
  const paidPayments    = payments.filter((p) => p.paid_at)
  const invoiceNumber   = inv.invoice_number ?? inv.booking_ref
  const hasTax          = inv.tax_amount > 0

  // Resolve itemised tax — prefer stored fields, fall back to split
  const vatAmt     = inv.vat_amount     > 0 ? inv.vat_amount     : splitGhanaTax(inv.tax_amount).vat
  const nhilAmt    = inv.nhil_amount    > 0 ? inv.nhil_amount    : splitGhanaTax(inv.tax_amount).nhil
  const getfundAmt = inv.getfund_amount > 0 ? inv.getfund_amount : splitGhanaTax(inv.tax_amount).getfund
  const subtotal   = inv.total_amount - inv.discount_amount

  return (
    <Document title={`Invoice ${invoiceNumber}`} author={hostelName}>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            {logoUrl ? (
              <Image src={logoUrl} style={s.logo} />
            ) : (
              <View style={s.logoBox}>
                <Text style={s.logoLetter}>{hostelName.charAt(0)}</Text>
              </View>
            )}
            <Text style={s.hostelName}>{hostelName}</Text>
            {hostelTagline  && <Text style={s.hostelSub}>{hostelTagline}</Text>}
            {hostelAddress  && <Text style={s.hostelSub}>{hostelAddress}</Text>}
            {hostelPhone    && <Text style={s.hostelSub}>{hostelPhone}</Text>}
            {hostelEmail    && <Text style={s.hostelSub}>{hostelEmail}</Text>}
            {tin && <Text style={s.tinText}>TIN: {tin}</Text>}
            {isVatRegistered && vatRegNumber && (
              <Text style={s.tinText}>VAT Reg: {vatRegNumber}</Text>
            )}
          </View>

          <View style={s.invoiceTag}>
            <Text style={s.invoiceType}>{isVatRegistered ? 'VAT Invoice' : 'Invoice'}</Text>
            <Text style={s.invoiceRef}>{invoiceNumber}</Text>
            <Text style={s.invoiceDate}>Issued: {dt(inv.created_at)}</Text>
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <Text style={[s.badgeText, { color: badge.text }]}>{inv.payment_status}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Bill to / Room grid ── */}
        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={s.sectionLabel}>Bill To</Text>
            <Text style={s.bold}>
              {occupant?.first_name} {occupant?.last_name}
              {occupant?.other_names ? ` ${occupant.other_names}` : ''}
            </Text>
            {occupant?.student_id  && <Text style={s.muted}>ID: {occupant.student_id}</Text>}
            {occupant?.institution && <Text style={s.muted}>{occupant.institution}</Text>}
            {occupant?.programme   && <Text style={s.muted}>{occupant.programme}</Text>}
            {occupant?.phone       && <Text style={[s.muted, { marginTop: 4 }]}>{occupant.phone}</Text>}
            {occupant?.email       && <Text style={s.muted}>{occupant.email}</Text>}
          </View>

          <View style={s.col}>
            <Text style={s.sectionLabel}>Room Details</Text>
            <Text style={s.bold}>
              Room {room?.room_number}
              {room?.block ? ` — Block ${room.block}` : ''}
              {room?.floor != null ? `, Floor ${room.floor}` : ''}
            </Text>
            <Text style={s.muted}>{categoryName}</Text>
            <Text style={[s.muted, { marginTop: 4 }]}>Check-in:  {dt(inv.check_in_date)}</Text>
            <Text style={s.muted}>Check-out: {dt(inv.check_out_date)}</Text>
            {inv.semester && <Text style={s.muted}>Semester: {inv.semester}</Text>}
          </View>
        </View>

        {/* ── Line items ── */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, s.colDesc]}>Description</Text>
            <Text style={[s.tableHeaderCell, s.colAmt]}>Amount (GHS)</Text>
          </View>

          <View style={s.tableRow}>
            <View style={s.colDesc}>
              <Text>Room accommodation — {categoryName}</Text>
              <Text style={{ fontSize: 8, color: '#a0aec0', marginTop: 2 }}>
                {dt(inv.check_in_date)} – {dt(inv.check_out_date)}
              </Text>
            </View>
            <Text style={s.colAmt}>{ghs(inv.total_amount)}</Text>
          </View>

          {inv.discount_amount > 0 && (
            <View style={s.tableRow}>
              <Text style={[s.colDesc, { color: '#718096' }]}>
                Discount{inv.discount_reason ? ` — ${inv.discount_reason}` : ''}
              </Text>
              <Text style={[s.colAmt, { color: '#276749' }]}>−{ghs(inv.discount_amount)}</Text>
            </View>
          )}
        </View>

        {/* ── Tax breakdown box (GRA-style) ── */}
        {hasTax ? (
          <View style={s.taxBox}>
            <View style={s.taxRow}>
              <Text style={s.taxLabel}>Subtotal (excl. taxes)</Text>
              <Text style={s.taxValue}>{ghs(subtotal)}</Text>
            </View>
            <View style={s.taxSeparator} />
            <View style={s.taxRow}>
              <Text style={s.taxLabel}>VAT (15%)</Text>
              <Text style={s.taxValue}>{ghs(vatAmt)}</Text>
            </View>
            <View style={s.taxRow}>
              <Text style={s.taxLabel}>NHIL (2.5%)</Text>
              <Text style={s.taxValue}>{ghs(nhilAmt)}</Text>
            </View>
            <View style={s.taxRow}>
              <Text style={s.taxLabel}>GETFund (2.5%)</Text>
              <Text style={s.taxValue}>{ghs(getfundAmt)}</Text>
            </View>
            <View style={s.taxSeparator} />
            <View style={s.taxRow}>
              <Text style={[s.taxLabel, { fontFamily: 'Helvetica-Bold', color: '#1a202c' }]}>Total</Text>
              <Text style={[s.taxValue, { fontFamily: 'Helvetica-Bold' }]}>{ghs(inv.final_amount)}</Text>
            </View>
          </View>
        ) : (
          /* No-tax simple total */
          <View style={{ marginTop: 12 }}>
            <View style={[s.totalRow, { borderTop: '1.5pt solid #1a202c', paddingTop: 6, marginTop: 6 }]}>
              <Text style={s.grandLabel}>Total</Text>
              <Text style={s.grandValue}>{ghs(inv.final_amount)}</Text>
            </View>
          </View>
        )}

        {/* Paid / Balance */}
        <View style={{ marginTop: 6 }}>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: '#276749' }]}>Amount paid</Text>
            <Text style={[s.totalValue, { color: '#276749' }]}>{ghs(inv.paid_amount)}</Text>
          </View>
          {balance > 0 && (
            <View style={s.totalRow}>
              <Text style={s.balanceLabel}>Balance due</Text>
              <Text style={s.balanceValue}>{ghs(balance)}</Text>
            </View>
          )}
        </View>

        {/* ── Payment history ── */}
        {paidPayments.length > 0 && (
          <View style={s.pmtSection}>
            <Text style={s.sectionLabel}>Payment History</Text>
            {paidPayments.map((p) => (
              <View key={p.id} style={s.pmtRow}>
                <Text style={{ color: '#718096' }}>{p.paid_at ? dt(p.paid_at) : '—'}</Text>
                <Text>{METHOD[p.method] ?? p.method}</Text>
                {p.reference
                  ? <Text style={{ color: '#a0aec0', fontSize: 8 }}>Ref: {p.reference}</Text>
                  : <Text> </Text>}
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#276749' }}>{ghs(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── GRA compliance notice ── */}
        <View style={s.graBox}>
          {isVatRegistered ? (
            <Text style={s.graText}>
              VAT, NHIL and GETFund are charged at 15%, 2.5% and 2.5% respectively on the taxable supply
              value, as required by the Value Added Tax Act 2013 (Act 870), the NHIL Act 2003 and the
              Ghana Education Trust Fund Act 2000. VAT Reg. No. {vatRegNumber ?? '—'} · TIN: {tin ?? '—'}.
            </Text>
          ) : (
            <Text style={s.graText}>
              NHIL (2.5%) and GETFund (2.5%) levies are included where applicable in accordance with
              Ghana Revenue Authority guidelines. {tin ? `TIN: ${tin}.` : ''}
              This is a computer-generated document and does not require a signature.
            </Text>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text>{hostelName} — Confidential</Text>
          <Text>{invoiceNumber}</Text>
          <Text>Thank you for your payment.</Text>
        </View>

      </Page>
    </Document>
  )
}
