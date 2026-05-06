/**
 * System default notification templates seeded per tenant.
 * Variables use {{mustache}} syntax — rendered by render.ts.
 */

export type EventType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment_received'
  | 'payment_reminder'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'lease_expiry_reminder'
  | 'deposit_refund'
  | 'bank_draft_submitted'
  | 'bank_draft_approved'
  | 'bank_draft_rejected'
  | 'maintenance_first_staff_reply'
  | 'maintenance_status_change'
  | 'maintenance_reopened'
  | 'food_order_ready'
  | 'food_order_cancelled'
  | 'food_order_placed_guest'

export type Channel = 'sms' | 'email'

export interface TemplateDefault {
  event_type: EventType
  channel:    Channel
  subject?:   string
  body:       string
}

export const DEFAULT_TEMPLATES: TemplateDefault[] = [
  // ── Booking confirmed ─────────────────────────────────────────────────────
  {
    event_type: 'booking_confirmed',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your booking at {{hostel_name}} is confirmed! ' +
      'Ref: {{booking_ref}} Room: {{room_number}} Check-in: {{check_in_date}}. ' +
      'Amount: {{amount}}. Keep this message as reference.',
  },
  {
    event_type: 'booking_confirmed',
    channel:    'email',
    subject:    'Booking confirmed — {{hostel_name}}',
    body:
      'Dear {{first_name}},\n\n' +
      'Your booking at {{hostel_name}} has been confirmed.\n\n' +
      'Booking Ref: {{booking_ref}}\n' +
      'Room: {{room_number}}\n' +
      'Check-in: {{check_in_date}}\n' +
      'Amount due: {{amount}}\n\n' +
      'Please keep your booking reference handy — you will need it at check-in.\n\n' +
      'We look forward to hosting you!',
  },

  // ── Booking cancelled ─────────────────────────────────────────────────────
  {
    event_type: 'booking_cancelled',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your booking {{booking_ref}} at {{hostel_name}} has been cancelled. ' +
      'Please contact us for refund details.',
  },
  {
    event_type: 'booking_cancelled',
    channel:    'email',
    subject:    'Booking cancelled — {{booking_ref}}',
    body:
      'Dear {{first_name}},\n\n' +
      'Your booking {{booking_ref}} at {{hostel_name}} has been cancelled.\n\n' +
      'If you believe this is a mistake or would like to discuss a refund, ' +
      'please reply to this email or contact the front desk.\n\n' +
      'We hope to welcome you another time.',
  },

  // ── Payment received ──────────────────────────────────────────────────────
  {
    event_type: 'payment_received',
    channel:    'sms',
    body:
      'Payment received — {{hostel_name}}. Hi {{first_name}}, we received {{amount}} ' +
      'for booking {{booking_ref}}. Outstanding balance: {{balance}}. Thank you!',
  },
  {
    event_type: 'payment_received',
    channel:    'email',
    subject:    'Payment received — {{booking_ref}}',
    body:
      'Dear {{first_name}},\n\n' +
      'We have received your payment.\n\n' +
      'Amount: {{amount}}\n' +
      'Booking Ref: {{booking_ref}}\n' +
      'Outstanding balance: {{balance}}\n\n' +
      'Thank you for your payment.',
  },

  // ── Payment reminder ──────────────────────────────────────────────────────
  {
    event_type: 'payment_reminder',
    channel:    'sms',
    body:
      'Rent reminder — {{hostel_name}}. Hi {{first_name}}, your payment of {{amount}} ' +
      'for {{booking_ref}} is due {{due_date}}. Please pay promptly to avoid losing your room.',
  },
  {
    event_type: 'payment_reminder',
    channel:    'email',
    subject:    'Payment reminder — {{booking_ref}}',
    body:
      'Dear {{first_name}},\n\n' +
      'This is a reminder that your payment of {{amount}} for booking {{booking_ref}} ' +
      'is due on {{due_date}}.\n\n' +
      'Please settle the balance promptly to secure your room.\n\n' +
      'Thank you.',
  },

  // ── Check-in reminder ─────────────────────────────────────────────────────
  {
    event_type: 'checkin_reminder',
    channel:    'sms',
    body:
      'Check-in reminder — {{hostel_name}}. Hi {{first_name}}, your check-in is on ' +
      '{{check_in_date}}. Room: {{room_number}}. See you then!',
  },
  {
    event_type: 'checkin_reminder',
    channel:    'email',
    subject:    'Your check-in at {{hostel_name}} is coming up',
    body:
      'Dear {{first_name}},\n\n' +
      'This is a friendly reminder that your check-in at {{hostel_name}} is on {{check_in_date}}.\n\n' +
      'Room: {{room_number}}\n\n' +
      'Please arrive with a valid ID and your booking reference. See you soon!',
  },

  // ── Check-out / lease expiry reminder ─────────────────────────────────────
  {
    event_type: 'checkout_reminder',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your stay at {{hostel_name}} ends on {{check_out_date}} ' +
      '(Ref: {{booking_ref}}). Contact us to renew or arrange checkout.',
  },
  {
    event_type: 'checkout_reminder',
    channel:    'email',
    subject:    'Your stay ends on {{check_out_date}}',
    body:
      'Dear {{first_name}},\n\n' +
      'Your stay at {{hostel_name}} (Ref: {{booking_ref}}) ends on {{check_out_date}}.\n\n' +
      'Please let us know whether you wish to renew your booking or arrange check-out. ' +
      'We are happy to help either way.\n\n' +
      'Thank you for staying with us.',
  },

  // ── Lease expiry (30-day) ─────────────────────────────────────────────────
  {
    event_type: 'lease_expiry_reminder',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your lease at {{hostel_name}} expires in {{days_remaining}} days ' +
      '({{check_out_date}}). Ref: {{booking_ref}}. Contact us to renew.',
  },
  {
    event_type: 'lease_expiry_reminder',
    channel:    'email',
    subject:    'Lease renewal notice — {{days_remaining}} days remaining',
    body:
      'Dear {{first_name}},\n\n' +
      'Your lease at {{hostel_name}} expires in {{days_remaining}} days on {{check_out_date}}.\n\n' +
      'Booking reference: {{booking_ref}}\n\n' +
      'If you would like to renew, please reply to this email or visit the front desk ' +
      'at your earliest convenience to avoid losing your room.',
  },

  // ── Deposit refund ────────────────────────────────────────────────────────
  {
    event_type: 'deposit_refund',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your deposit refund of {{refund_amount}} for booking ' +
      '{{booking_ref}} at {{hostel_name}} has been processed.',
  },
  {
    event_type: 'deposit_refund',
    channel:    'email',
    subject:    'Deposit refund processed — {{booking_ref}}',
    body:
      'Dear {{first_name}},\n\n' +
      'Your deposit refund of {{refund_amount}} for booking {{booking_ref}} at ' +
      '{{hostel_name}} has been processed.\n\n' +
      'Please allow 3–5 business days for the funds to arrive in your account.\n\n' +
      'Thank you for staying with us.',
  },

  // ── Bank draft submitted (admin-facing) ───────────────────────────────────
  {
    event_type: 'bank_draft_submitted',
    channel:    'sms',
    body:
      'New bank draft on {{hostel_name}}: {{student_name}} uploaded ' +
      'GHS {{amount}} for {{booking_ref}}. Review: {{review_url}}',
  },

  // ── Bank draft approved (student-facing) ──────────────────────────────────
  {
    event_type: 'bank_draft_approved',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your bank draft of GHS {{amount}} for booking ' +
      '{{booking_ref}} at {{hostel_name}} has been confirmed. ' +
      'Outstanding balance: GHS {{balance}}. Thank you.',
  },

  // ── Bank draft rejected (student-facing) ──────────────────────────────────
  {
    event_type: 'bank_draft_rejected',
    channel:    'sms',
    body:
      'Hi {{first_name}}, we couldn\'t confirm your bank draft of GHS ' +
      '{{amount}} for {{booking_ref}} ({{hostel_name}}). Reason: {{reason}}. ' +
      'Please re-upload via the resident portal.',
  },

  // ── Maintenance — first staff reply ───────────────────────────────────────
  {
    event_type: 'maintenance_first_staff_reply',
    channel:    'sms',
    body:
      'Hi {{first_name}}, hostel staff replied to your maintenance request ' +
      '{{request_id}} at {{hostel_name}}. Open the resident portal to view.',
  },

  // ── Maintenance — status change ───────────────────────────────────────────
  {
    event_type: 'maintenance_status_change',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your request {{request_id}} at {{hostel_name}} ' +
      'moved from {{from}} to {{to}}.',
  },

  // ── Maintenance — reopened ────────────────────────────────────────────────
  {
    event_type: 'maintenance_reopened',
    channel:    'sms',
    body:
      'Hi {{first_name}}, hostel staff reopened your request {{request_id}} ' +
      'at {{hostel_name}}.',
  },

  // ── Food order — ready for pickup ─────────────────────────────────────────
  {
    event_type: 'food_order_ready',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your food order {{order_ref}} at {{hostel_name}} ' +
      'is ready for pickup.',
  },

  // ── Food order — cancelled ────────────────────────────────────────────────
  {
    event_type: 'food_order_cancelled',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your food order {{order_ref}} at {{hostel_name}} ' +
      'was cancelled. Reason: {{reason}}.',
  },

  // ── Food order — placed (guest channels: walk-in QR + online) ────────────
  {
    event_type: 'food_order_placed_guest',
    channel:    'sms',
    body:
      'Hi {{first_name}}, your order {{order_ref}} at {{hostel_name}} is placed. ' +
      'Track it: {{tracking_url}}',
  },
]
