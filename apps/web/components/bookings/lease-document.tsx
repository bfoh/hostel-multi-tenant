import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', padding: 56 },
  title:       { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 4 },
  subtitle:    { fontSize: 10, textAlign: 'center', color: '#6b7280', marginBottom: 28 },
  divider:     { borderBottomWidth: 1, borderBottomColor: '#d1d5db', marginVertical: 14 },
  sectionHead: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6, marginTop: 16 },
  para:        { lineHeight: 1.7, color: '#374151', marginBottom: 8 },
  clauseNum:   { fontFamily: 'Helvetica-Bold', marginRight: 4 },
  row:         { flexDirection: 'row', marginBottom: 5 },
  label:       { width: 140, fontSize: 9, color: '#6b7280' },
  value:       { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  sigBlock:    { flexDirection: 'row', gap: 40, marginTop: 40 },
  sigCol:      { flex: 1 },
  sigLine:     { borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 4, height: 28 },
  sigLabel:    { fontSize: 8, color: '#6b7280' },
  footer:      { position: 'absolute', bottom: 32, left: 56, right: 56, textAlign: 'center', fontSize: 8, color: '#9ca3af' },
})

function GHS(p: number) { return `GH₵ ${(p / 100).toFixed(2)}` }

interface Props { booking: any; tenant: any }

export function LeaseDocument({ booking, tenant }: Props) {
  const occ  = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const room = Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms
  const cat  = room ? (Array.isArray(room.room_categories) ? room.room_categories[0] : room.room_categories) : null
  const today = new Date().toLocaleDateString('en-GH', { dateStyle: 'long' })
  const occName = occ ? `${occ.first_name} ${occ.other_names ? occ.other_names + ' ' : ''}${occ.last_name}` : 'Occupant'

  return (
    <Document title={`Tenancy Agreement — ${booking.booking_ref}`} author={tenant?.name ?? 'Hostel'}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.title}>{tenant?.name ?? 'HOSTEL'}</Text>
        <Text style={styles.subtitle}>TENANCY AGREEMENT / ACCOMMODATION CONTRACT</Text>
        <View style={styles.divider} />

        {/* Parties */}
        <Text style={styles.sectionHead}>PARTIES</Text>
        <View style={styles.row}><Text style={styles.label}>Landlord / Manager</Text><Text style={styles.value}>{tenant?.name ?? '—'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Contact</Text><Text style={styles.value}>{[tenant?.phone, tenant?.email].filter(Boolean).join(' · ') || '—'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Address</Text><Text style={styles.value}>{tenant?.address ?? '—'}</Text></View>

        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.label}>Tenant / Occupant</Text><Text style={styles.value}>{occName}</Text></View>
        {occ?.student_id  && <View style={styles.row}><Text style={styles.label}>Student ID</Text><Text style={styles.value}>{occ.student_id}</Text></View>}
        {occ?.institution && <View style={styles.row}><Text style={styles.label}>Institution</Text><Text style={styles.value}>{occ.institution}</Text></View>}
        {occ?.phone       && <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{occ.phone}</Text></View>}
        {occ?.email       && <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{occ.email}</Text></View>}

        {/* Premises */}
        <View style={styles.divider} />
        <Text style={styles.sectionHead}>PREMISES</Text>
        <View style={styles.row}><Text style={styles.label}>Room</Text><Text style={styles.value}>Room {room?.room_number ?? '—'}{room?.block ? `, Block ${room.block}` : ''}{room?.floor != null ? `, Floor ${room.floor}` : ''}</Text></View>
        {cat && <View style={styles.row}><Text style={styles.label}>Room type</Text><Text style={styles.value}>{cat.name}</Text></View>}
        <View style={styles.row}><Text style={styles.label}>Booking reference</Text><Text style={styles.value}>{booking.booking_ref}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Commencement date</Text><Text style={styles.value}>{booking.check_in_date}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Termination date</Text><Text style={styles.value}>{booking.check_out_date ?? 'Open-ended'}</Text></View>
        {booking.semester && <View style={styles.row}><Text style={styles.label}>Semester / Period</Text><Text style={styles.value}>{booking.semester} {booking.academic_year ?? ''}</Text></View>}

        {/* Financial */}
        <View style={styles.divider} />
        <Text style={styles.sectionHead}>FINANCIAL TERMS</Text>
        <View style={styles.row}><Text style={styles.label}>Accommodation fee</Text><Text style={styles.value}>{GHS(booking.total_amount)} per {booking.rate_unit}</Text></View>
        {booking.discount_amount > 0 && <View style={styles.row}><Text style={styles.label}>Discount</Text><Text style={styles.value}>{GHS(booking.discount_amount)}{booking.discount_reason ? ` (${booking.discount_reason})` : ''}</Text></View>}
        {booking.tax_amount > 0 && <View style={styles.row}><Text style={styles.label}>Tax / Levy</Text><Text style={styles.value}>{GHS(booking.tax_amount)}</Text></View>}
        <View style={styles.row}><Text style={styles.label}>Total payable</Text><Text style={styles.value}>{GHS(booking.final_amount)}</Text></View>

        {/* Clauses */}
        <View style={styles.divider} />
        <Text style={styles.sectionHead}>TERMS AND CONDITIONS</Text>

        {[
          ['1.', 'The tenant agrees to pay the accommodation fee in full on or before the commencement date. Late payments may attract a surcharge as determined by management.'],
          ['2.', 'The tenant shall maintain the room and common areas in a clean and orderly condition and shall not cause damage to hostel property. Any damage caused shall be repaired at the tenant\'s expense.'],
          ['3.', 'The tenant shall not sub-let the room or allow any other person to occupy the room without the written consent of management.'],
          ['4.', 'Noise, parties, and activities that disturb other occupants are strictly prohibited. Management reserves the right to terminate this agreement for repeated violations.'],
          ['5.', 'The tenant shall adhere to all hostel rules and regulations as posted on the notice board or communicated by management from time to time.'],
          ['6.', 'Management reserves the right to enter the room for inspection or maintenance purposes with reasonable notice to the tenant.'],
          ['7.', 'Upon vacating the room, the tenant shall return all keys and access cards. Failure to do so will result in deduction from any refundable deposit.'],
          ['8.', 'This agreement may be terminated by either party with a minimum of 30 days written notice, subject to the hostel\'s refund policy.'],
          ['9.', 'The hostel management shall not be liable for loss or damage to personal property of the tenant howsoever caused.'],
          ['10.', 'Any dispute arising from this agreement shall first be resolved amicably. If unresolved, it shall be referred to the applicable law of Ghana.'],
        ].map(([num, text]) => (
          <View key={num as string} style={styles.row}>
            <Text style={styles.clauseNum}>{num}</Text>
            <Text style={[styles.para, { flex: 1 }]}>{text}</Text>
          </View>
        ))}

        {/* Signatures */}
        <View style={styles.sigBlock}>
          <View style={styles.sigCol}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Signature of Tenant</Text>
            <Text style={[styles.sigLabel, { marginTop: 4 }]}>{occName}</Text>
            <Text style={[styles.sigLabel, { marginTop: 4 }]}>Date: _______________</Text>
          </View>
          <View style={styles.sigCol}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Authorised Signature (Management)</Text>
            <Text style={[styles.sigLabel, { marginTop: 4 }]}>{tenant?.name ?? ''}</Text>
            <Text style={[styles.sigLabel, { marginTop: 4 }]}>Date: _______________</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Generated on {today} · {booking.booking_ref} · {tenant?.name ?? 'GH Hostels'}</Text>
        </View>
      </Page>
    </Document>
  )
}
