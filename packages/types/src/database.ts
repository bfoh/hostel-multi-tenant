/**
 * Supabase database types — derived from migrations.
 *
 * Keep in sync with supabase/migrations/*.sql.
 * When you add or alter a table, update the corresponding Row/Insert/Update types here.
 *
 * Tip: once the project is in production, replace this file with the output of:
 *   npx supabase gen types typescript --project-id <id> > packages/types/src/database.ts
 */

// ── Shared primitives ────────────────────────────────────────────────────────

type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ── Enum string unions ───────────────────────────────────────────────────────

type SubscriptionPlan   = 'starter' | 'growth' | 'pro' | 'enterprise'
type TenantStatus       = 'trial' | 'active' | 'suspended' | 'cancelled'
type TenantRole         = 'owner' | 'manager' | 'receptionist' | 'housekeeper' | 'accountant' | 'security' | 'occupant'
type RoomStatus         = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'blocked'
type HousekeepingStatus = 'clean' | 'dirty' | 'inspecting' | 'out_of_order'
type RoomType           = 'single' | 'double' | 'twin' | 'triple' | 'quad' | 'dormitory' | 'suite' | 'studio'
type BookingStatus      = 'enquiry' | 'pending_payment' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
type BookingSource      = 'walk_in' | 'phone' | 'website' | 'widget' | 'voice_ai' | 'referral' | 'online'
type PaymentStatus      = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'disputed'
type PaymentMethod      = 'momo_mtn' | 'momo_vodafone' | 'momo_airteltigo' | 'card' | 'bank_transfer' | 'cash' | 'cheque'
type OccupantType       = 'student' | 'non_student' | 'professional' | 'guest' | 'staff'
type OccupantStatus     = 'active' | 'checked_out' | 'pending' | 'suspended' | 'blacklisted'
type GenderType         = 'male' | 'female' | 'prefer_not_to_say'
type IdType             = 'ghana_card' | 'passport' | 'voters_id' | 'nhis'
type EmploymentType     = 'full_time' | 'part_time' | 'contract' | 'casual'
type LeaveType          = 'annual' | 'sick' | 'maternity' | 'paternity' | 'emergency' | 'unpaid'
type LeaveStatus        = 'pending' | 'approved' | 'rejected' | 'cancelled'
type PayrollStatus      = 'draft' | 'approved' | 'paid'
type MaintenancePriority  = 'low' | 'medium' | 'high' | 'urgent'
type MaintenanceStatus    = 'open' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
type MaintenanceCategory  = 'plumbing' | 'electrical' | 'hvac' | 'structural' | 'cleaning' | 'furniture' | 'appliance' | 'pest_control' | 'security' | 'other'
type IncidentSeverity   = 'low' | 'medium' | 'high' | 'critical'
type IncidentStatus     = 'open' | 'investigating' | 'closed'
type VisitorPurpose     = 'visit_occupant' | 'delivery' | 'maintenance' | 'official' | 'other'
type LostFoundType      = 'lost' | 'found'
type LostFoundStatus    = 'unclaimed' | 'claimed' | 'disposed'
type SmsBlastStatus     = 'pending' | 'scheduled' | 'sent' | 'failed'

// ── Relationship helper ──────────────────────────────────────────────────────

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

// ── Database root type ───────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          slug: string
          name: string
          plan: SubscriptionPlan
          status: TenantStatus
          trial_ends_at: string | null
          custom_domain: string | null
          primary_color: string | null
          accent_color: string | null
          logo_url: string | null
          favicon_url: string | null
          font_display: string | null
          font_body: string | null
          currency: string
          timezone: string
          country: string
          sms_enabled: boolean
          email_enabled: boolean
          momo_enabled: boolean
          card_enabled: boolean
          voice_ai_enabled: boolean
          widget_enabled: boolean
          widget_api_key: string | null
          ai_persona_name: string | null
          ai_persona_voice: string | null
          semester_system: boolean
          auto_checkout_enabled: boolean
          late_checkout_fee_percent: number
          paystack_customer_id: string | null
          billing_email: string | null
          is_active: boolean
          contact_phone: string | null
          contact_email: string | null
          address_line1: string | null
          address_city: string | null
          address_region: string | null
          website_url: string | null
          tagline: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          plan?: SubscriptionPlan
          status?: TenantStatus
          trial_ends_at?: string | null
          custom_domain?: string | null
          primary_color?: string | null
          accent_color?: string | null
          logo_url?: string | null
          favicon_url?: string | null
          font_display?: string | null
          font_body?: string | null
          currency?: string
          timezone?: string
          country?: string
          sms_enabled?: boolean
          email_enabled?: boolean
          momo_enabled?: boolean
          card_enabled?: boolean
          voice_ai_enabled?: boolean
          widget_enabled?: boolean
          widget_api_key?: string | null
          ai_persona_name?: string | null
          ai_persona_voice?: string | null
          semester_system?: boolean
          auto_checkout_enabled?: boolean
          late_checkout_fee_percent?: number
          paystack_customer_id?: string | null
          billing_email?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          address_line1?: string | null
          address_city?: string | null
          address_region?: string | null
          website_url?: string | null
          tagline?: string | null
        }
        Update: {
          slug?: string
          name?: string
          plan?: SubscriptionPlan
          status?: TenantStatus
          trial_ends_at?: string | null
          custom_domain?: string | null
          primary_color?: string | null
          accent_color?: string | null
          logo_url?: string | null
          favicon_url?: string | null
          font_display?: string | null
          font_body?: string | null
          currency?: string
          timezone?: string
          country?: string
          sms_enabled?: boolean
          email_enabled?: boolean
          momo_enabled?: boolean
          card_enabled?: boolean
          voice_ai_enabled?: boolean
          widget_enabled?: boolean
          widget_api_key?: string | null
          ai_persona_name?: string | null
          ai_persona_voice?: string | null
          semester_system?: boolean
          auto_checkout_enabled?: boolean
          late_checkout_fee_percent?: number
          paystack_customer_id?: string | null
          billing_email?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          address_line1?: string | null
          address_city?: string | null
          address_region?: string | null
          website_url?: string | null
          tagline?: string | null
        }
        Relationships: []
      }

      tenant_members: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          role: TenantRole
          is_active: boolean
          invited_by: string | null
          invited_at: string | null
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          role?: TenantRole
          is_active?: boolean
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string | null
        }
        Update: {
          role?: TenantRole
          is_active?: boolean
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'tenant_members_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      room_categories: {
        Row: {
          id: string
          tenant_id: string
          name: string
          type: RoomType
          base_rate: number
          rate_unit: string
          capacity: number
          amenities: string[]
          description: string | null
          image_urls: string[]
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          type: RoomType
          base_rate: number
          rate_unit?: string
          capacity?: number
          amenities?: string[]
          description?: string | null
          image_urls?: string[]
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          type?: RoomType
          base_rate?: number
          rate_unit?: string
          capacity?: number
          amenities?: string[]
          description?: string | null
          image_urls?: string[]
          is_active?: boolean
          sort_order?: number
        }
        Relationships: [
          { foreignKeyName: 'room_categories_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      rooms: {
        Row: {
          id: string
          tenant_id: string
          category_id: string
          room_number: string
          floor: number | null
          block: string | null
          status: RoomStatus
          housekeeping_status: HousekeepingStatus
          notes: string | null
          last_cleaned_at: string | null
          last_inspected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          category_id: string
          room_number: string
          floor?: number | null
          block?: string | null
          status?: RoomStatus
          housekeeping_status?: HousekeepingStatus
          notes?: string | null
          last_cleaned_at?: string | null
          last_inspected_at?: string | null
        }
        Update: {
          category_id?: string
          room_number?: string
          floor?: number | null
          block?: string | null
          status?: RoomStatus
          housekeeping_status?: HousekeepingStatus
          notes?: string | null
          last_cleaned_at?: string | null
          last_inspected_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'rooms_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'rooms_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'room_categories'; referencedColumns: ['id'] }
        ]
      }

      occupants: {
        Row: {
          id: string
          tenant_id: string
          type: OccupantType
          status: OccupantStatus
          first_name: string
          last_name: string
          other_names: string | null
          gender: GenderType | null
          date_of_birth: string | null
          national_id_type: IdType | null
          national_id_number: string | null
          photo_url: string | null
          phone: string
          alternate_phone: string | null
          email: string | null
          home_address: string | null
          region_of_origin: string | null
          institution: string | null
          student_id: string | null
          programme: string | null
          year_of_study: number | null
          semester: string | null
          emergency_contact: Json | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type?: OccupantType
          status?: OccupantStatus
          first_name: string
          last_name: string
          other_names?: string | null
          gender?: GenderType | null
          date_of_birth?: string | null
          national_id_type?: IdType | null
          national_id_number?: string | null
          photo_url?: string | null
          phone: string
          alternate_phone?: string | null
          email?: string | null
          home_address?: string | null
          region_of_origin?: string | null
          institution?: string | null
          student_id?: string | null
          programme?: string | null
          year_of_study?: number | null
          semester?: string | null
          emergency_contact?: Json | null
          notes?: string | null
        }
        Update: {
          type?: OccupantType
          status?: OccupantStatus
          first_name?: string
          last_name?: string
          other_names?: string | null
          gender?: GenderType | null
          date_of_birth?: string | null
          national_id_type?: IdType | null
          national_id_number?: string | null
          photo_url?: string | null
          phone?: string
          alternate_phone?: string | null
          email?: string | null
          home_address?: string | null
          region_of_origin?: string | null
          institution?: string | null
          student_id?: string | null
          programme?: string | null
          year_of_study?: number | null
          semester?: string | null
          emergency_contact?: Json | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'occupants_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      bookings: {
        Row: {
          id: string
          tenant_id: string
          booking_ref: string
          occupant_id: string
          room_id: string
          status: BookingStatus
          source: BookingSource
          check_in_date: string
          check_out_date: string
          actual_check_in: string | null
          actual_check_out: string | null
          rate_per_unit: number
          rate_unit: string
          total_amount: number
          discount_amount: number
          discount_reason: string | null
          tax_amount: number
          final_amount: number
          payment_status: PaymentStatus
          paid_amount: number
          semester: string | null
          academic_year: string | null
          notes: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          booking_ref?: string
          occupant_id: string
          room_id: string
          status?: BookingStatus
          source?: BookingSource
          check_in_date: string
          check_out_date: string
          actual_check_in?: string | null
          actual_check_out?: string | null
          rate_per_unit?: number
          rate_unit?: string
          total_amount?: number
          discount_amount?: number
          discount_reason?: string | null
          tax_amount?: number
          final_amount?: number
          payment_status?: PaymentStatus
          paid_amount?: number
          semester?: string | null
          academic_year?: string | null
          notes?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          created_by?: string | null
        }
        Update: {
          status?: BookingStatus
          source?: BookingSource
          check_in_date?: string
          check_out_date?: string
          actual_check_in?: string | null
          actual_check_out?: string | null
          rate_per_unit?: number
          rate_unit?: string
          total_amount?: number
          discount_amount?: number
          discount_reason?: string | null
          tax_amount?: number
          payment_status?: PaymentStatus
          paid_amount?: number
          semester?: string | null
          academic_year?: string | null
          notes?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
        }
        Relationships: [
          { foreignKeyName: 'bookings_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'bookings_occupant_id_fkey'; columns: ['occupant_id']; isOneToOne: false; referencedRelation: 'occupants'; referencedColumns: ['id'] },
          { foreignKeyName: 'bookings_room_id_fkey'; columns: ['room_id']; isOneToOne: false; referencedRelation: 'rooms'; referencedColumns: ['id'] }
        ]
      }

      booking_payments: {
        Row: {
          id: string
          tenant_id: string
          booking_id: string
          amount: number
          method: PaymentMethod
          reference: string | null
          paystack_reference: string | null
          status: string
          paid_at: string | null
          received_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          booking_id: string
          amount: number
          method: PaymentMethod
          reference?: string | null
          paystack_reference?: string | null
          status?: string
          paid_at?: string | null
          received_by?: string | null
          notes?: string | null
        }
        Update: {
          amount?: number
          method?: PaymentMethod
          reference?: string | null
          paystack_reference?: string | null
          status?: string
          paid_at?: string | null
          received_by?: string | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'booking_payments_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'booking_payments_booking_id_fkey'; columns: ['booking_id']; isOneToOne: false; referencedRelation: 'bookings'; referencedColumns: ['id'] }
        ]
      }

      audit_log: {
        Row: {
          id: number
          tenant_id: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          description: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          occurred_at: string
        }
        Insert: {
          tenant_id: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          description?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          occurred_at?: string
        }
        Update: never
        Relationships: []
      }

      staff_profiles: {
        Row: {
          id: string
          tenant_id: string
          member_id: string
          user_id: string | null
          first_name: string
          last_name: string
          other_names: string | null
          date_of_birth: string | null
          gender: GenderType | null
          phone: string | null
          email: string | null
          photo_url: string | null
          ghana_card_number: string | null
          ghana_card_url: string | null
          employee_id: string | null
          employment_type: EmploymentType
          job_title: string | null
          department: string | null
          start_date: string | null
          end_date: string | null
          is_active: boolean
          basic_salary: number
          tin_number: string | null
          ssnit_number: string | null
          is_ssnit_exempt: boolean
          bank_name: string | null
          bank_branch: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          momo_number: string | null
          momo_network: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relation: string | null
          address: string | null
          city: string | null
          region: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          member_id: string
          user_id?: string | null
          first_name: string
          last_name: string
          other_names?: string | null
          date_of_birth?: string | null
          gender?: GenderType | null
          phone?: string | null
          email?: string | null
          photo_url?: string | null
          ghana_card_number?: string | null
          ghana_card_url?: string | null
          employee_id?: string | null
          employment_type?: EmploymentType
          job_title?: string | null
          department?: string | null
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          basic_salary?: number
          tin_number?: string | null
          ssnit_number?: string | null
          is_ssnit_exempt?: boolean
          bank_name?: string | null
          bank_branch?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          momo_number?: string | null
          momo_network?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          address?: string | null
          city?: string | null
          region?: string | null
        }
        Update: {
          first_name?: string
          last_name?: string
          other_names?: string | null
          date_of_birth?: string | null
          gender?: GenderType | null
          phone?: string | null
          email?: string | null
          photo_url?: string | null
          ghana_card_number?: string | null
          ghana_card_url?: string | null
          employee_id?: string | null
          employment_type?: EmploymentType
          job_title?: string | null
          department?: string | null
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          basic_salary?: number
          tin_number?: string | null
          ssnit_number?: string | null
          is_ssnit_exempt?: boolean
          bank_name?: string | null
          bank_branch?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          momo_number?: string | null
          momo_network?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          address?: string | null
          city?: string | null
          region?: string | null
        }
        Relationships: [
          { foreignKeyName: 'staff_profiles_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'staff_profiles_member_id_fkey'; columns: ['member_id']; isOneToOne: true; referencedRelation: 'tenant_members'; referencedColumns: ['id'] }
        ]
      }

      attendance_records: {
        Row: {
          id: string
          tenant_id: string
          staff_id: string
          date: string
          clock_in: string | null
          clock_out: string | null
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          staff_id: string
          date: string
          clock_in?: string | null
          clock_out?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          notes?: string | null
          recorded_by?: string | null
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          notes?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          { foreignKeyName: 'attendance_records_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'attendance_records_staff_id_fkey'; columns: ['staff_id']; isOneToOne: false; referencedRelation: 'staff_profiles'; referencedColumns: ['id'] }
        ]
      }

      leave_requests: {
        Row: {
          id: string
          tenant_id: string
          staff_id: string
          leave_type: LeaveType
          start_date: string
          end_date: string
          days: number
          reason: string | null
          status: LeaveStatus
          reviewed_by: string | null
          reviewed_at: string | null
          review_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          staff_id: string
          leave_type: LeaveType
          start_date: string
          end_date: string
          reason?: string | null
          status?: LeaveStatus
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_note?: string | null
        }
        Update: {
          leave_type?: LeaveType
          start_date?: string
          end_date?: string
          reason?: string | null
          status?: LeaveStatus
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_note?: string | null
        }
        Relationships: [
          { foreignKeyName: 'leave_requests_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'leave_requests_staff_id_fkey'; columns: ['staff_id']; isOneToOne: false; referencedRelation: 'staff_profiles'; referencedColumns: ['id'] }
        ]
      }

      payroll_runs: {
        Row: {
          id: string
          tenant_id: string
          period_start: string
          period_end: string
          total_gross: number
          status: PayrollStatus
          notes: string | null
          created_by: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          period_start: string
          period_end: string
          total_gross?: number
          status?: PayrollStatus
          notes?: string | null
          created_by?: string | null
          paid_at?: string | null
        }
        Update: {
          period_start?: string
          period_end?: string
          total_gross?: number
          status?: PayrollStatus
          notes?: string | null
          paid_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'payroll_runs_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      payroll_items: {
        Row: {
          id: string
          tenant_id: string
          payroll_run_id: string
          staff_id: string
          basic_salary: number
          allowances: number
          ssnit_employee: number
          ssnit_employer: number
          paye_tax: number
          other_deductions: number
          net_salary: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          payroll_run_id: string
          staff_id: string
          basic_salary: number
          allowances?: number
          ssnit_employee?: number
          ssnit_employer?: number
          paye_tax?: number
          other_deductions?: number
          net_salary: number
          status?: string
        }
        Update: {
          basic_salary?: number
          allowances?: number
          ssnit_employee?: number
          ssnit_employer?: number
          paye_tax?: number
          other_deductions?: number
          net_salary?: number
          status?: string
        }
        Relationships: [
          { foreignKeyName: 'payroll_items_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'payroll_items_payroll_run_id_fkey'; columns: ['payroll_run_id']; isOneToOne: false; referencedRelation: 'payroll_runs'; referencedColumns: ['id'] },
          { foreignKeyName: 'payroll_items_staff_id_fkey'; columns: ['staff_id']; isOneToOne: false; referencedRelation: 'staff_profiles'; referencedColumns: ['id'] }
        ]
      }

      contractors: {
        Row: {
          id: string
          tenant_id: string
          name: string
          company: string | null
          phone: string
          email: string | null
          specialty: MaintenanceCategory
          rating: number | null
          notes: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          company?: string | null
          phone: string
          email?: string | null
          specialty?: MaintenanceCategory
          rating?: number | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          company?: string | null
          phone?: string
          email?: string | null
          specialty?: MaintenanceCategory
          rating?: number | null
          notes?: string | null
          is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'contractors_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      maintenance_requests: {
        Row: {
          id: string
          tenant_id: string
          ref_number: string
          title: string
          description: string | null
          category: MaintenanceCategory
          priority: MaintenancePriority
          status: MaintenanceStatus
          room_id: string | null
          contractor_id: string | null
          scheduled_date: string | null
          assigned_at: string | null
          resolved_at: string | null
          actual_cost: number | null
          estimated_cost: number | null
          notes: string | null
          reported_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          ref_number?: string
          title: string
          description?: string | null
          category?: MaintenanceCategory
          priority?: MaintenancePriority
          status?: MaintenanceStatus
          room_id?: string | null
          contractor_id?: string | null
          scheduled_date?: string | null
          assigned_at?: string | null
          resolved_at?: string | null
          actual_cost?: number | null
          estimated_cost?: number | null
          notes?: string | null
          reported_by?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          category?: MaintenanceCategory
          priority?: MaintenancePriority
          status?: MaintenanceStatus
          room_id?: string | null
          contractor_id?: string | null
          scheduled_date?: string | null
          assigned_at?: string | null
          resolved_at?: string | null
          actual_cost?: number | null
          estimated_cost?: number | null
          notes?: string | null
          reported_by?: string | null
        }
        Relationships: [
          { foreignKeyName: 'maintenance_requests_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] },
          { foreignKeyName: 'maintenance_requests_room_id_fkey'; columns: ['room_id']; isOneToOne: false; referencedRelation: 'rooms'; referencedColumns: ['id'] },
          { foreignKeyName: 'maintenance_requests_contractor_id_fkey'; columns: ['contractor_id']; isOneToOne: false; referencedRelation: 'contractors'; referencedColumns: ['id'] }
        ]
      }

      visitor_log: {
        Row: {
          id: string
          tenant_id: string
          visitor_name: string
          visitor_phone: string | null
          visitor_id: string | null
          purpose: VisitorPurpose
          host_name: string | null
          room_number: string | null
          vehicle_plate: string | null
          check_in_at: string
          check_out_at: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          visitor_name: string
          visitor_phone?: string | null
          visitor_id?: string | null
          purpose?: VisitorPurpose
          host_name?: string | null
          room_number?: string | null
          vehicle_plate?: string | null
          check_in_at?: string
          check_out_at?: string | null
          notes?: string | null
          recorded_by?: string | null
        }
        Update: {
          visitor_name?: string
          visitor_phone?: string | null
          visitor_id?: string | null
          purpose?: VisitorPurpose
          host_name?: string | null
          room_number?: string | null
          vehicle_plate?: string | null
          check_in_at?: string
          check_out_at?: string | null
          notes?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          { foreignKeyName: 'visitor_log_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      incident_reports: {
        Row: {
          id: string
          tenant_id: string
          ref_number: string
          title: string
          description: string
          severity: IncidentSeverity
          status: IncidentStatus
          occurred_at: string
          location: string | null
          involved_parties: string | null
          action_taken: string | null
          police_ref: string | null
          reported_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          ref_number?: string
          title: string
          description: string
          severity?: IncidentSeverity
          status?: IncidentStatus
          occurred_at?: string
          location?: string | null
          involved_parties?: string | null
          action_taken?: string | null
          police_ref?: string | null
          reported_by?: string | null
        }
        Update: {
          title?: string
          description?: string
          severity?: IncidentSeverity
          status?: IncidentStatus
          occurred_at?: string
          location?: string | null
          involved_parties?: string | null
          action_taken?: string | null
          police_ref?: string | null
        }
        Relationships: [
          { foreignKeyName: 'incident_reports_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      lost_found_items: {
        Row: {
          id: string
          tenant_id: string
          type: LostFoundType
          item_name: string
          description: string | null
          location_found: string | null
          found_date: string
          owner_name: string | null
          owner_phone: string | null
          room_number: string | null
          status: LostFoundStatus
          recorded_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type?: LostFoundType
          item_name: string
          description?: string | null
          location_found?: string | null
          found_date?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          room_number?: string | null
          status?: LostFoundStatus
          recorded_by?: string | null
          notes?: string | null
        }
        Update: {
          type?: LostFoundType
          item_name?: string
          description?: string | null
          location_found?: string | null
          found_date?: string
          owner_name?: string | null
          owner_phone?: string | null
          room_number?: string | null
          status?: LostFoundStatus
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'lost_found_items_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      sms_blasts: {
        Row: {
          id: string
          tenant_id: string
          message: string
          recipient_type: string
          recipient_count: number
          sent_count: number
          failed_count: number
          status: SmsBlastStatus
          created_by: string | null
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          message: string
          recipient_type?: string
          recipient_count?: number
          sent_count?: number
          failed_count?: number
          status?: SmsBlastStatus
          created_by?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
        }
        Update: {
          message?: string
          recipient_type?: string
          recipient_count?: number
          sent_count?: number
          failed_count?: number
          status?: SmsBlastStatus
          scheduled_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'sms_blasts_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }
    }
    Views: Record<string, {
      Row: Record<string, unknown>
      Relationships: {
        foreignKeyName: string
        columns: string[]
        isOneToOne: boolean
        referencedRelation: string
        referencedColumns: string[]
      }[]
    }>
    Functions: Record<string, {
      Args: Record<string, unknown>
      Returns: unknown
    }>
    Enums: {
      subscription_plan: SubscriptionPlan
      tenant_status: TenantStatus
      tenant_role: TenantRole
      room_status: RoomStatus
      housekeeping_status: HousekeepingStatus
      room_type: RoomType
      booking_status: BookingStatus
      booking_source: BookingSource
      payment_status: PaymentStatus
      payment_method: PaymentMethod
      occupant_type: OccupantType
      occupant_status: OccupantStatus
      gender_type: GenderType
      id_type: IdType
      employment_type: EmploymentType
      leave_type: LeaveType
      leave_status: LeaveStatus
      payroll_status: PayrollStatus
      maintenance_priority: MaintenancePriority
      maintenance_status: MaintenanceStatus
      maintenance_category: MaintenanceCategory
      incident_severity: IncidentSeverity
      incident_status: IncidentStatus
      visitor_purpose: VisitorPurpose
      lost_found_type: LostFoundType
      lost_found_status: LostFoundStatus
      sms_blast_status: SmsBlastStatus
    }
  }
}
