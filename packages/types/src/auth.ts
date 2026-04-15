// ── Auth & RBAC ───────────────────────────────────────────────────────────────

/**
 * Platform-level roles (for GH Hostels employees managing hostels).
 * Stored in auth.users app_metadata.
 */
export type PlatformRole = 'platform_admin' | 'platform_support'

/**
 * Tenant-level roles (for hostel staff and occupants).
 * Stored in tenant_members.role and injected into JWT claims.
 */
export type TenantRole =
  | 'owner'           // Full access, billing, can see all analytics
  | 'manager'         // Full hostel ops, cannot change billing
  | 'receptionist'    // Check-in/out, bookings, basic reports
  | 'housekeeper'     // Housekeeping tasks only — simplified UI
  | 'accountant'      // Invoices, payments, financial reports only
  | 'security'        // Visitor log, access control only
  | 'occupant'        // Student/guest portal — own data only

/**
 * Module-level permissions derived from role.
 * Used to gate UI elements and API routes.
 */
export interface Permissions {
  // Occupant management
  viewOccupants: boolean
  manageOccupants: boolean

  // Rooms
  viewRooms: boolean
  manageRooms: boolean

  // Bookings
  viewBookings: boolean
  createBookings: boolean
  manageBookings: boolean
  cancelBookings: boolean

  // Payments
  viewPayments: boolean
  recordPayments: boolean
  issueRefunds: boolean

  // Housekeeping
  viewHousekeeping: boolean
  manageHousekeeping: boolean

  // Reports & Analytics
  viewReports: boolean
  viewFinancialReports: boolean
  viewOwnerIntelligence: boolean   // "Eye and ear" dashboard — owner only

  // Settings
  viewSettings: boolean
  manageSettings: boolean
  manageBilling: boolean           // Owner only

  // Staff management
  viewStaff: boolean
  manageStaff: boolean
}

export const ROLE_PERMISSIONS: Record<TenantRole, Permissions> = {
  owner: {
    viewOccupants: true, manageOccupants: true,
    viewRooms: true, manageRooms: true,
    viewBookings: true, createBookings: true, manageBookings: true, cancelBookings: true,
    viewPayments: true, recordPayments: true, issueRefunds: true,
    viewHousekeeping: true, manageHousekeeping: true,
    viewReports: true, viewFinancialReports: true, viewOwnerIntelligence: true,
    viewSettings: true, manageSettings: true, manageBilling: true,
    viewStaff: true, manageStaff: true,
  },
  manager: {
    viewOccupants: true, manageOccupants: true,
    viewRooms: true, manageRooms: true,
    viewBookings: true, createBookings: true, manageBookings: true, cancelBookings: true,
    viewPayments: true, recordPayments: true, issueRefunds: true,
    viewHousekeeping: true, manageHousekeeping: true,
    viewReports: true, viewFinancialReports: true, viewOwnerIntelligence: false,
    viewSettings: true, manageSettings: true, manageBilling: false,
    viewStaff: true, manageStaff: true,
  },
  receptionist: {
    viewOccupants: true, manageOccupants: true,
    viewRooms: true, manageRooms: false,
    viewBookings: true, createBookings: true, manageBookings: true, cancelBookings: false,
    viewPayments: true, recordPayments: true, issueRefunds: false,
    viewHousekeeping: true, manageHousekeeping: false,
    viewReports: true, viewFinancialReports: false, viewOwnerIntelligence: false,
    viewSettings: false, manageSettings: false, manageBilling: false,
    viewStaff: false, manageStaff: false,
  },
  housekeeper: {
    viewOccupants: false, manageOccupants: false,
    viewRooms: true, manageRooms: false,
    viewBookings: false, createBookings: false, manageBookings: false, cancelBookings: false,
    viewPayments: false, recordPayments: false, issueRefunds: false,
    viewHousekeeping: true, manageHousekeeping: true,
    viewReports: false, viewFinancialReports: false, viewOwnerIntelligence: false,
    viewSettings: false, manageSettings: false, manageBilling: false,
    viewStaff: false, manageStaff: false,
  },
  accountant: {
    viewOccupants: true, manageOccupants: false,
    viewRooms: false, manageRooms: false,
    viewBookings: true, createBookings: false, manageBookings: false, cancelBookings: false,
    viewPayments: true, recordPayments: true, issueRefunds: true,
    viewHousekeeping: false, manageHousekeeping: false,
    viewReports: true, viewFinancialReports: true, viewOwnerIntelligence: false,
    viewSettings: false, manageSettings: false, manageBilling: false,
    viewStaff: false, manageStaff: false,
  },
  security: {
    viewOccupants: true, manageOccupants: false,
    viewRooms: true, manageRooms: false,
    viewBookings: true, createBookings: false, manageBookings: false, cancelBookings: false,
    viewPayments: false, recordPayments: false, issueRefunds: false,
    viewHousekeeping: false, manageHousekeeping: false,
    viewReports: false, viewFinancialReports: false, viewOwnerIntelligence: false,
    viewSettings: false, manageSettings: false, manageBilling: false,
    viewStaff: false, manageStaff: false,
  },
  occupant: {
    viewOccupants: false, manageOccupants: false,
    viewRooms: false, manageRooms: false,
    viewBookings: true, createBookings: true, manageBookings: false, cancelBookings: false,
    viewPayments: true, recordPayments: false, issueRefunds: false,
    viewHousekeeping: false, manageHousekeeping: false,
    viewReports: false, viewFinancialReports: false, viewOwnerIntelligence: false,
    viewSettings: false, manageSettings: false, manageBilling: false,
    viewStaff: false, manageStaff: false,
  },
}
