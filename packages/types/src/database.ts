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
          tin: string | null
          vat_reg_number: string | null
          is_vat_registered: boolean
          ai_config: Json | null
          onboarding_completed: boolean
          website_content: Json | null
          widget_domains: string[]
          public_api_key: string | null
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
          tin?: string | null
          vat_reg_number?: string | null
          is_vat_registered?: boolean
          ai_config?: Json | null
          onboarding_completed?: boolean
          website_content?: Json | null
          widget_domains?: string[]
          public_api_key?: string | null
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
          tin?: string | null
          vat_reg_number?: string | null
          is_vat_registered?: boolean
          ai_config?: Json | null
          onboarding_completed?: boolean
          website_content?: Json | null
          widget_domains?: string[]
          public_api_key?: string | null
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
          user_id: string | null
          id_verified: boolean
          id_verified_at: string | null
          id_rejection_notes: string | null
          portal_enabled: boolean
          portal_invite_sent_at: string | null
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
          user_id?: string | null
          id_verified?: boolean
          id_verified_at?: string | null
          id_rejection_notes?: string | null
          portal_enabled?: boolean
          portal_invite_sent_at?: string | null
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
          user_id?: string | null
          id_verified?: boolean
          id_verified_at?: string | null
          id_rejection_notes?: string | null
          portal_enabled?: boolean
          portal_invite_sent_at?: string | null
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
          vat_amount: number | null
          nhil_amount: number | null
          getfund_amount: number | null
          hold_expires_at: string | null
          paystack_reference: string | null
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
          vat_amount?: number | null
          nhil_amount?: number | null
          getfund_amount?: number | null
          hold_expires_at?: string | null
          paystack_reference?: string | null
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
          room_id?: string
          cancelled_at?: string | null
          cancellation_reason?: string | null
          vat_amount?: number | null
          nhil_amount?: number | null
          getfund_amount?: number | null
          hold_expires_at?: string | null
          paystack_reference?: string | null
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
          role: string | null
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
          role?: string | null
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
          role?: string | null
          job_title?: string | null
          department?: string | null
          user_id?: string | null
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
          status: string
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
          status?: string
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
          status?: string
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
          pm_schedule_id: string | null
          source: string | null
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
          pm_schedule_id?: string | null
          source?: string | null
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
          pm_schedule_id?: string | null
          source?: string | null
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
          item_name: string | null
          description: string
          category: string | null
          location_found: string | null
          found_location: string | null
          found_date: string
          occupant_id: string | null
          room_id: string | null
          owner_name: string | null
          owner_phone: string | null
          room_number: string | null
          status: string
          claimed_by: string | null
          claimed_at: string | null
          recorded_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type?: LostFoundType
          item_name?: string | null
          description: string
          category?: string | null
          location_found?: string | null
          found_location?: string | null
          found_date: string
          occupant_id?: string | null
          room_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          room_number?: string | null
          status?: string
          claimed_by?: string | null
          claimed_at?: string | null
          recorded_by?: string | null
          notes?: string | null
        }
        Update: {
          type?: LostFoundType
          item_name?: string | null
          description?: string
          category?: string | null
          location_found?: string | null
          found_location?: string | null
          found_date?: string
          occupant_id?: string | null
          room_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          room_number?: string | null
          status?: string
          claimed_by?: string | null
          claimed_at?: string | null
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
          recipient_filter: Json | null
          recipient_count: number
          sent_count: number
          failed_count: number
          status: SmsBlastStatus
          created_by: string | null
          sent_by: string | null
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          message: string
          recipient_type?: string
          recipient_filter?: Json | null
          sent_by?: string | null
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

      assets: {
        Row: {
          id: string
          tenant_id: string
          name: string
          category: string
          description: string | null
          brand: string | null
          model: string | null
          serial_number: string | null
          room_id: string | null
          location_note: string | null
          purchase_date: string | null
          purchase_price: number | null
          supplier: string | null
          warranty_expiry: string | null
          condition: string
          status: string
          qr_code: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          category?: string
          description?: string | null
          brand?: string | null
          model?: string | null
          serial_number?: string | null
          room_id?: string | null
          location_note?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          supplier?: string | null
          warranty_expiry?: string | null
          condition?: string
          status?: string
          qr_code?: string
          notes?: string | null
        }
        Update: {
          name?: string
          category?: string
          description?: string | null
          brand?: string | null
          model?: string | null
          serial_number?: string | null
          room_id?: string | null
          location_note?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          supplier?: string | null
          warranty_expiry?: string | null
          condition?: string
          status?: string
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'assets_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      booking_otps: {
        Row: {
          id: string
          tenant_id: string
          phone: string
          otp_code: string
          booking_context: Json | null
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          phone: string
          otp_code: string
          booking_context?: Json | null
          expires_at: string
          used_at?: string | null
        }
        Update: {
          used_at?: string | null
        }
        Relationships: []
      }

      occupant_blacklist: {
        Row: {
          id: string
          tenant_id: string
          occupant_id: string | null
          phone: string | null
          reason: string | null
          severity: string
          is_active: boolean
          expires_at: string | null
          added_by: string | null
          lifted_at: string | null
          lifted_by: string | null
          lift_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          occupant_id?: string | null
          phone?: string | null
          reason?: string | null
          severity?: string
          is_active?: boolean
          expires_at?: string | null
          added_by?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          lift_reason?: string | null
        }
        Update: {
          reason?: string | null
          severity?: string
          is_active?: boolean
          expires_at?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          lift_reason?: string | null
        }
        Relationships: [
          { foreignKeyName: 'occupant_blacklist_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      room_keys: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          key_code: string
          occupant_id: string | null
          booking_id: string | null
          issued_at: string | null
          returned_at: string | null
          status: string
          notes: string | null
          issued_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          room_id: string
          key_code: string
          occupant_id?: string | null
          booking_id?: string | null
          issued_at?: string | null
          returned_at?: string | null
          status?: string
          notes?: string | null
          issued_by?: string | null
        }
        Update: {
          occupant_id?: string | null
          booking_id?: string | null
          issued_at?: string | null
          returned_at?: string | null
          status?: string
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'room_keys_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      webhook_endpoints: {
        Row: {
          id: string
          tenant_id: string
          url: string
          secret: string | null
          events: string[]
          is_active: boolean
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          url: string
          secret?: string | null
          events?: string[]
          is_active?: boolean
          description?: string | null
        }
        Update: {
          url?: string
          secret?: string | null
          events?: string[]
          is_active?: boolean
          description?: string | null
        }
        Relationships: [
          { foreignKeyName: 'webhook_endpoints_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      webhook_events: {
        Row: {
          id: string
          tenant_id: string
          endpoint_id: string
          event_type: string
          payload: Json
          status: string
          response_status: number | null
          response_body: string | null
          attempts: number
          last_attempt_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          endpoint_id: string
          event_type: string
          payload: Json
          status?: string
          response_status?: number | null
          response_body?: string | null
          attempts?: number
          last_attempt_at?: string | null
        }
        Update: {
          status?: string
          response_status?: number | null
          response_body?: string | null
          attempts?: number
          last_attempt_at?: string | null
        }
        Relationships: []
      }

      pm_schedules: {
        Row: {
          id: string
          tenant_id: string
          title: string
          description: string | null
          category: MaintenanceCategory
          frequency: string
          interval_value: number
          start_date: string | null
          next_due_date: string | null
          room_id: string | null
          location_note: string | null
          default_priority: string
          default_contractor_id: string | null
          estimated_cost_ghs: number | null
          assigned_to: string | null
          status: string
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          title: string
          description?: string | null
          category?: MaintenanceCategory
          frequency?: string
          interval_value?: number
          start_date?: string | null
          next_due_date?: string | null
          room_id?: string | null
          location_note?: string | null
          default_priority?: string
          default_contractor_id?: string | null
          estimated_cost_ghs?: number | null
          assigned_to?: string | null
          status?: string
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          title?: string
          description?: string | null
          category?: MaintenanceCategory
          frequency?: string
          interval_value?: number
          start_date?: string | null
          next_due_date?: string | null
          room_id?: string | null
          location_note?: string | null
          default_priority?: string
          default_contractor_id?: string | null
          estimated_cost_ghs?: number | null
          assigned_to?: string | null
          status?: string
          notes?: string | null
          is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'pm_schedules_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      id_verification_reviews: {
        Row: {
          id: string
          tenant_id: string
          occupant_id: string
          reviewer_id: string | null
          document_id: string | null
          decision: string | null
          status: string
          notes: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          occupant_id: string
          reviewer_id?: string | null
          document_id?: string | null
          decision?: string | null
          status?: string
          notes?: string | null
          reviewed_at?: string | null
        }
        Update: {
          status?: string
          decision?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          { foreignKeyName: 'id_verification_reviews_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      notification_templates: {
        Row: {
          id: string
          tenant_id: string
          event_type: string
          channel: string
          subject: string | null
          body: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          event_type: string
          channel?: string
          subject?: string | null
          body: string
          is_active?: boolean
        }
        Update: {
          event_type?: string
          channel?: string
          subject?: string | null
          body?: string
          is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'notification_templates_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      push_subscriptions: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          keys: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          endpoint: string
          p256dh?: string
          auth_key?: string
          keys?: Json | null
        }
        Update: {
          endpoint?: string
          p256dh?: string
          auth_key?: string
          keys?: Json | null
        }
        Relationships: [
          { foreignKeyName: 'push_subscriptions_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      report_schedules: {
        Row: {
          id: string
          tenant_id: string
          name: string
          report_type: string
          frequency: string
          day_of_week: number | null
          day_of_month: number | null
          recipients: string[]
          last_run_at: string | null
          last_sent_at: string | null
          next_run_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          report_type: string
          frequency?: string
          day_of_week?: number | null
          day_of_month?: number | null
          recipients?: string[]
          last_run_at?: string | null
          next_run_at?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          report_type?: string
          frequency?: string
          day_of_week?: number | null
          day_of_month?: number | null
          recipients?: string[]
          last_run_at?: string | null
          last_sent_at?: string | null
          next_run_at?: string | null
          is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'report_schedules_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      notices: {
        Row: {
          id: string
          tenant_id: string
          title: string
          body: string
          category: string
          audience: string
          priority: string
          is_pinned: boolean
          published_at: string | null
          expires_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          title: string
          body: string
          category?: string
          audience?: string
          priority?: string
          is_pinned?: boolean
          published_at?: string | null
          expires_at?: string | null
          created_by?: string | null
        }
        Update: {
          title?: string
          body?: string
          category?: string
          audience?: string
          priority?: string
          is_pinned?: boolean
          published_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'notices_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      payment_plans: {
        Row: {
          id: string
          tenant_id: string
          booking_id: string
          name: string
          total_amount: number
          installments_count: number
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          booking_id: string
          name: string
          total_amount: number
          installments_count?: number
          status?: string
          created_by?: string | null
        }
        Update: {
          name?: string
          total_amount?: number
          installments_count?: number
          status?: string
        }
        Relationships: [
          { foreignKeyName: 'payment_plans_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      payment_plan_installments: {
        Row: {
          id: string
          tenant_id: string
          plan_id: string
          installment_number: number
          amount: number
          due_date: string
          paid_at: string | null
          payment_method: string | null
          reference: string | null
          status: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          plan_id: string
          installment_number?: number
          amount: number
          due_date: string
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string
          notes?: string | null
        }
        Update: {
          installment_number?: number
          amount?: number
          due_date?: string
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string
          notes?: string | null
        }
        Relationships: []
      }

      expenses: {
        Row: {
          id: string
          tenant_id: string
          category: string
          description: string
          amount: number
          expense_date: string
          payment_method: string | null
          reference: string | null
          vendor: string | null
          receipt_url: string | null
          approved_by: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          category: string
          description: string
          amount: number
          expense_date: string
          payment_method?: string | null
          reference?: string | null
          vendor?: string | null
          receipt_url?: string | null
          approved_by?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          category?: string
          description?: string
          amount?: number
          expense_date?: string
          payment_method?: string | null
          reference?: string | null
          vendor?: string | null
          receipt_url?: string | null
          approved_by?: string | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'expenses_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      occupant_documents: {
        Row: {
          id: string
          tenant_id: string
          occupant_id: string
          doc_type: string
          label: string | null
          url: string
          uploaded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          occupant_id: string
          doc_type: string
          label?: string | null
          url: string
          uploaded_at?: string
        }
        Update: {
          doc_type?: string
          label?: string | null
          url?: string
        }
        Relationships: [
          { foreignKeyName: 'occupant_documents_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      housekeeping_tasks: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          booking_id: string | null
          task_type: string
          status: string
          priority: string
          source: string | null
          assigned_to: string | null
          due_by: string | null
          scheduled_at: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          room_id: string
          booking_id?: string | null
          task_type?: string
          status?: string
          priority?: string
          source?: string | null
          assigned_to?: string | null
          due_by?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
        }
        Update: {
          task_type?: string
          status?: string
          priority?: string
          source?: string | null
          assigned_to?: string | null
          due_by?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'housekeeping_tasks_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      room_inspections: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          inspector_id: string | null
          status: string
          notes: string | null
          inspected_at: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          room_id: string
          inspector_id?: string | null
          status?: string
          notes?: string | null
          inspected_at?: string
        }
        Update: {
          status?: string
          notes?: string | null
          inspected_at?: string
        }
        Relationships: [
          { foreignKeyName: 'room_inspections_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      rate_overrides: {
        Row: {
          id: string
          tenant_id: string
          room_id: string | null
          category_id: string | null
          name: string
          rate: number
          rate_unit: string
          valid_from: string | null
          valid_to: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          room_id?: string | null
          category_id?: string | null
          name: string
          rate: number
          rate_unit?: string
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          rate?: number
          rate_unit?: string
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'rate_overrides_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      shift_rotations: {
        Row: {
          id: string
          tenant_id: string
          name: string
          week_start: string
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          week_start: string
          status?: string
          created_by?: string | null
        }
        Update: {
          name?: string
          week_start?: string
          status?: string
        }
        Relationships: [
          { foreignKeyName: 'shift_rotations_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      shift_assignments: {
        Row: {
          id: string
          tenant_id: string
          rotation_id: string
          staff_id: string
          day_of_week: number
          start_time: string
          end_time: string
          role: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          rotation_id: string
          staff_id: string
          day_of_week: number
          start_time: string
          end_time: string
          role?: string | null
        }
        Update: {
          day_of_week?: number
          start_time?: string
          end_time?: string
          role?: string | null
        }
        Relationships: []
      }

      meter_readings: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          utility_type: string
          reading_value: number
          previous_value: number | null
          unit: string
          unit_rate: number
          reading_date: string
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          room_id: string
          utility_type?: string
          reading_value: number
          previous_value?: number | null
          unit?: string
          unit_rate?: number
          reading_date: string
          notes?: string | null
          recorded_by?: string | null
        }
        Update: {
          reading_value?: number
          previous_value?: number | null
          unit?: string
          unit_rate?: number
          reading_date?: string
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'meter_readings_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      damage_deposits: {
        Row: {
          id: string
          tenant_id: string
          booking_id: string
          occupant_id: string | null
          amount: number
          method: string
          reference: string | null
          collected_at: string
          status: string
          refund_amount: number | null
          refund_reason: string | null
          resolved_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          booking_id: string
          occupant_id?: string | null
          amount: number
          method?: string
          reference?: string | null
          collected_at?: string
          status?: string
          refund_amount?: number | null
          refund_reason?: string | null
          resolved_at?: string | null
          notes?: string | null
        }
        Update: {
          amount?: number
          method?: string
          reference?: string | null
          collected_at?: string
          status?: string
          refund_amount?: number | null
          refund_reason?: string | null
          resolved_at?: string | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'damage_deposits_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      occupant_feedback: {
        Row: {
          id: string
          tenant_id: string
          booking_id: string | null
          occupant_id: string | null
          overall_rating: number
          cleanliness_rating: number | null
          staff_rating: number | null
          value_rating: number | null
          would_recommend: boolean | null
          comments: string | null
          is_anonymous: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          booking_id?: string | null
          occupant_id?: string | null
          overall_rating: number
          cleanliness_rating?: number | null
          staff_rating?: number | null
          value_rating?: number | null
          would_recommend?: boolean | null
          comments?: string | null
          is_anonymous?: boolean
        }
        Update: {
          overall_rating?: number
          cleanliness_rating?: number | null
          staff_rating?: number | null
          value_rating?: number | null
          would_recommend?: boolean | null
          comments?: string | null
        }
        Relationships: [
          { foreignKeyName: 'occupant_feedback_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      staff_shifts: {
        Row: {
          id: string
          tenant_id: string
          staff_id: string
          shift_date: string
          shift_start: string
          shift_end: string
          department: string | null
          position: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          staff_id: string
          shift_date: string
          shift_start: string
          shift_end: string
          department?: string | null
          position?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          shift_date?: string
          shift_start?: string
          shift_end?: string
          department?: string | null
          position?: string | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'staff_shifts_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      anomaly_alerts: {
        Row: {
          id: string
          tenant_id: string
          type: string
          severity: string
          title: string
          message: string
          data: Json | null
          is_read: boolean
          sms_sent: boolean
          sms_sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type: string
          severity?: string
          title: string
          message: string
          data?: Json | null
          is_read?: boolean
          sms_sent?: boolean
          sms_sent_at?: string | null
        }
        Update: {
          is_read?: boolean
          sms_sent?: boolean
          sms_sent_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'anomaly_alerts_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      platform_admins: {
        Row: {
          id: string
          user_id: string
          email: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          role?: string
        }
        Update: {
          role?: string
        }
        Relationships: []
      }

      visitor_logs: {
        Row: {
          id: string
          tenant_id: string
          visitor_name: string
          visitor_phone: string | null
          purpose: VisitorPurpose
          host_name: string | null
          room_number: string | null
          check_in_at: string
          checked_in_at: string | null
          check_out_at: string | null
          expected_at: string | null
          pass_token: string | null
          pass_status: string | null
          pass_used_at: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          visitor_name: string
          visitor_phone?: string | null
          purpose?: VisitorPurpose
          host_name?: string | null
          room_number?: string | null
          check_in_at?: string
          checked_in_at?: string | null
          check_out_at?: string | null
          expected_at?: string | null
          pass_token?: string | null
          pass_status?: string | null
          pass_used_at?: string | null
          notes?: string | null
          recorded_by?: string | null
        }
        Update: {
          check_out_at?: string | null
          checked_in_at?: string | null
          pass_status?: string | null
          pass_used_at?: string | null
          notes?: string | null
        }
        Relationships: [
          { foreignKeyName: 'visitor_logs_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
        ]
      }

      waiting_list: {
        Row: {
          id: string
          tenant_id: string
          occupant_id: string | null
          name: string
          phone: string
          email: string | null
          room_type: string | null
          preferred_date: string | null
          notes: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          occupant_id?: string | null
          name: string
          phone: string
          email?: string | null
          room_type?: string | null
          preferred_date?: string | null
          notes?: string | null
          status?: string
        }
        Update: {
          name?: string
          phone?: string
          email?: string | null
          room_type?: string | null
          preferred_date?: string | null
          notes?: string | null
          status?: string
        }
        Relationships: [
          { foreignKeyName: 'waiting_list_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }
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
