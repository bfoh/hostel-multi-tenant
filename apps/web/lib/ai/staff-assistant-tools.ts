/** Tools in this set never execute inline; staff must confirm them first. */
export const WRITE_TOOLS = new Set([
  'create_booking',
  'cancel_booking',
  'add_charge',
  'check_in',
  'check_out',
])

export function buildTools(isHotel: boolean) {
  const tools = [
    {
      name: 'lookup_booking',
      description:
        'Look up a booking by its reference number. Use this to answer questions about an existing booking or before cancelling/checking a guest in or out.',
      input_schema: {
        type: 'object',
        properties: {
          booking_ref: { type: 'string', description: 'Booking reference, e.g. ABR-2026-123456' },
        },
        required: ['booking_ref'],
      },
    },
    {
      name: 'check_room_availability',
      description: 'Check which rooms are available for a date range.',
      input_schema: {
        type: 'object',
        properties: {
          check_in_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          check_out_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        },
        required: ['check_in_date', 'check_out_date'],
      },
    },
    {
      name: 'create_booking',
      description:
        "Create a new booking for a guest. Requires an available room number (from check_room_availability) and the guest's details. This is a real, billable action — confirm the details with the staff member before calling it.",
      input_schema: {
        type: 'object',
        properties: {
          room_number: { type: 'string', description: 'Room number, e.g. "101"' },
          check_in_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          check_out_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          guest_first_name: { type: 'string' },
          guest_last_name: { type: 'string' },
          guest_phone: { type: 'string', description: 'Guest phone number, e.g. 0244000000' },
          guest_email: { type: 'string' },
        },
        required: [
          'room_number',
          'check_in_date',
          'check_out_date',
          'guest_first_name',
          'guest_last_name',
          'guest_phone',
        ],
      },
    },
    {
      name: 'cancel_booking',
      description:
        'Cancel an existing booking. This is irreversible — confirm with staff before calling it.',
      input_schema: {
        type: 'object',
        properties: {
          booking_ref: { type: 'string' },
          reason: { type: 'string', description: 'Why the booking is being cancelled' },
        },
        required: ['booking_ref', 'reason'],
      },
    },
    {
      name: 'check_in',
      description: 'Check a guest in for their booking (booking must be confirmed).',
      input_schema: {
        type: 'object',
        properties: { booking_ref: { type: 'string' } },
        required: ['booking_ref'],
      },
    },
    {
      name: 'check_out',
      description: 'Check a guest out of their booking.',
      input_schema: {
        type: 'object',
        properties: { booking_ref: { type: 'string' } },
        required: ['booking_ref'],
      },
    },
  ]

  if (isHotel) {
    tools.push({
      name: 'add_charge',
      description: 'Add a folio charge (minibar, room service, laundry, etc.) to a booking.',
      input_schema: {
        type: 'object',
        properties: {
          booking_ref: { type: 'string' },
          description: { type: 'string', description: 'e.g. "2x Coca-Cola"' },
          category: {
            type: 'string',
            enum: [
              'food_beverage',
              'room_service',
              'minibar',
              'laundry',
              'phone_internet',
              'parking',
              'other',
            ],
          },
          amount_ghs: { type: 'number', description: 'Total charge amount in GHS, e.g. 25.50' },
        },
        required: ['booking_ref', 'description', 'category', 'amount_ghs'],
      },
    } as any)
  }

  return tools
}
