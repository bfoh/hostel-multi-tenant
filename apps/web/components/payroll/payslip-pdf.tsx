import {
  Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    fontSize:        10,
    color:           '#1a202c',
    paddingTop:      48,
    paddingBottom:   48,
    paddingHorizontal: 52,
    backgroundColor: '#ffffff',
  },

  /* Header */
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  logoBox: {
    width: 48, height: 48,
    backgroundColor: '#1B4F72',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter:  { color: '#ffffff', fontSize: 20, fontFamily: 'Helvetica-Bold' },
  logo:        { width: 48, height: 48, objectFit: 'contain' },
  hostelName:  { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1B4F72' },
  hostelSub:   { fontSize: 8, color: '#718096', marginTop: 2 },
  payslipTag:  { textAlign: 'right' },
  payslipLabel:{ fontSize: 8, color: '#718096', textTransform: 'uppercase', letterSpacing: 1 },
  payslipRef:  { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  payslipDate: { fontSize: 8, color: '#718096', marginTop: 2 },

  divider: { borderBottom: '1pt solid #e2e8f0', marginVertical: 18 },

  /* Employee / Period grid */
  grid2: { flexDirection: 'row', gap: 24, marginBottom: 4 },
  col:   { flex: 1 },
  sectionLabel: { fontSize: 8, color: '#718096', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  boldText:  { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  mutedText: { color: '#718096', marginTop: 2 },

  /* Earnings / Deductions table */
  table:       { marginTop: 20 },
  tableHeader: { flexDirection: 'row', borderBottom: '1pt solid #e2e8f0', paddingBottom: 6, marginBottom: 4 },
  tableHeaderCell: { fontSize: 8, color: '#718096', textTransform: 'uppercase', letterSpacing: 0.8 },
  tableRow:    { flexDirection: 'row', paddingVertical: 7, borderBottom: '0.5pt solid #f0f0f0' },
  colDesc:     { flex: 1 },
  colAmount:   { width: 90, textAlign: 'right' },

  /* Totals */
  totals:     { marginTop: 16, alignItems: 'flex-end' },
  totalRow:   { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
  totalLabel: { width: 160, textAlign: 'right', color: '#718096' },
  totalValue: { width: 90, textAlign: 'right' },
  netBox: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  netInner: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 250,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeft: '3pt solid #16a34a',
  },
  netLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  netValue: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#16a34a' },

  /* SSNIT note */
  note: { marginTop: 24, fontSize: 8, color: '#718096', lineHeight: 1.5 },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#a0aec0',
    borderTop: '0.5pt solid #e2e8f0',
    paddingTop: 8,
  },
})

function ghs(pesewas: number) {
  return `GH₵ ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface PayslipItem {
  id: string
  basic_salary: number
  allowances: number
  ssnit_employee: number
  ssnit_employer: number
  paye_tax: number
  other_deductions: number
  net_salary: number
  staff: {
    id: string
    first_name: string
    last_name: string
    job_title: string | null
    is_ssnit_exempt: boolean | null
  } | null
}

interface PayslipPDFProps {
  run: {
    period_start: string
    period_end: string
  }
  items: PayslipItem[]
  hostelName: string
  hostelAddress: string | null
  hostelPhone: string | null
  logoUrl: string | null
}

export function PayslipPDF({ run, items, hostelName, hostelAddress, hostelPhone, logoUrl }: PayslipPDFProps) {
  const period = `${fmtDate(run.period_start)} – ${fmtDate(run.period_end)}`

  return (
    <Document title={`Payslips — ${period}`} author={hostelName}>
      {items.map(item => {
        const staff = item.staff
        const name  = staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown'
        const gross = item.basic_salary + item.allowances
        const totalDed = item.ssnit_employee + item.paye_tax + item.other_deductions

        return (
          <Page key={item.id} size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                {logoUrl ? (
                  <Image src={logoUrl} style={styles.logo} />
                ) : (
                  <View style={styles.logoBox}>
                    <Text style={styles.logoLetter}>{hostelName[0]}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.hostelName}>{hostelName}</Text>
                  {hostelAddress && <Text style={styles.hostelSub}>{hostelAddress}</Text>}
                  {hostelPhone   && <Text style={styles.hostelSub}>{hostelPhone}</Text>}
                </View>
              </View>
              <View style={styles.payslipTag}>
                <Text style={styles.payslipLabel}>Payslip</Text>
                <Text style={styles.payslipRef}>{name}</Text>
                <Text style={styles.payslipDate}>{period}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Employee & Period */}
            <View style={styles.grid2}>
              <View style={styles.col}>
                <Text style={styles.sectionLabel}>Employee</Text>
                <Text style={styles.boldText}>{name}</Text>
                {staff?.job_title && <Text style={styles.mutedText}>{staff.job_title}</Text>}
                {staff?.is_ssnit_exempt && <Text style={[styles.mutedText, { color: '#d97706' }]}>SSNIT Exempt</Text>}
              </View>
              <View style={styles.col}>
                <Text style={styles.sectionLabel}>Pay period</Text>
                <Text style={styles.boldText}>{fmtDate(run.period_start)}</Text>
                <Text style={styles.mutedText}>to {fmtDate(run.period_end)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Earnings table */}
            <View style={styles.table}>
              <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>Earnings</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.colDesc}>Basic salary</Text>
                <Text style={styles.colAmount}>{ghs(item.basic_salary)}</Text>
              </View>
              {item.allowances > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.colDesc}>Allowances</Text>
                  <Text style={styles.colAmount}>{ghs(item.allowances)}</Text>
                </View>
              )}
              <View style={[styles.tableRow, { borderBottom: '1pt solid #e2e8f0' }]}>
                <Text style={[styles.colDesc, { fontFamily: 'Helvetica-Bold' }]}>Gross salary</Text>
                <Text style={[styles.colAmount, { fontFamily: 'Helvetica-Bold' }]}>{ghs(gross)}</Text>
              </View>
            </View>

            {/* Deductions table */}
            <View style={[styles.table, { marginTop: 16 }]}>
              <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>Deductions</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.colDesc}>SSNIT (employee 5.5%)</Text>
                <Text style={[styles.colAmount, { color: '#dc2626' }]}>{ghs(item.ssnit_employee)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.colDesc}>PAYE income tax</Text>
                <Text style={[styles.colAmount, { color: '#dc2626' }]}>{ghs(item.paye_tax)}</Text>
              </View>
              {item.other_deductions > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.colDesc}>Other deductions</Text>
                  <Text style={[styles.colAmount, { color: '#dc2626' }]}>{ghs(item.other_deductions)}</Text>
                </View>
              )}
              <View style={[styles.tableRow, { borderBottom: '1pt solid #e2e8f0' }]}>
                <Text style={[styles.colDesc, { fontFamily: 'Helvetica-Bold' }]}>Total deductions</Text>
                <Text style={[styles.colAmount, { fontFamily: 'Helvetica-Bold', color: '#dc2626' }]}>{ghs(totalDed)}</Text>
              </View>
            </View>

            {/* Employer SSNIT note */}
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Employer SSNIT contribution (13%)</Text>
                <Text style={styles.totalValue}>{ghs(item.ssnit_employer)}</Text>
              </View>
            </View>

            {/* Net pay box */}
            <View style={styles.netBox}>
              <View style={styles.netInner}>
                <Text style={styles.netLabel}>Net pay (take-home)</Text>
                <Text style={styles.netValue}>{ghs(item.net_salary)}</Text>
              </View>
            </View>

            {/* Note */}
            <Text style={styles.note}>
              This payslip is computer-generated. SSNIT rates: Employee 5.5% | Employer 13%.
              Ghana GRA PAYE 2024 tax bands applied. All amounts in Ghana Cedis (GHS).
            </Text>

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text>{hostelName} — Confidential Payslip</Text>
              <Text>{period}</Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
