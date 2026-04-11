-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 013 — Per-tenant AI agent configuration
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists ai_config jsonb not null default '{}'::jsonb;

comment on column tenants.ai_config is
  'Per-tenant AI chat agent settings.
   Shape: {
     ai_enabled:      boolean,
     agent_name:      string,
     personality:     "professional" | "friendly" | "casual",
     language:        "en" | "tw",
     custom_greeting: string | null,
     tools_enabled: {
       check_availability: boolean,
       get_pricing:        boolean,
       search_faqs:        boolean,
       escalate_to_human:  boolean
     }
   }';
