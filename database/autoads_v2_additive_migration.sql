-- ============================================================================
-- AUTO ADS v2 — MIGRACIÓN ESTRICTAMENTE ADITIVA (NO DESTRUCTIVA)
-- Circuito A: Inteligencia Publicitaria, Hipótesis Psicológicas y Atribución (Independiente del Courier)
-- Circuito B: Logística 3 Ejes, Costos Reales, Liquidaciones Courier, FX y Purchase CAPI Independiente
-- Regla: 100% idempotente. Organizada en 4 bloques cortos para evitar timeouts en Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- BLOQUE 1 / 4: TABLAS NUEVAS CIRCUITO A (SIN BLOQUEOS SOBRE TABLAS EXISTENTES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_attribution (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT,
  reservaid TEXT NOT NULL,
  client_request_key TEXT,
  visitor_id TEXT,
  product_slug TEXT NOT NULL,
  attribution_channel TEXT NOT NULL DEFAULT 'direct',
  attribution_method TEXT NOT NULL DEFAULT 'none',
  attribution_confidence NUMERIC NOT NULL DEFAULT 0,
  ad_id TEXT,
  adset_id TEXT,
  campaign_id TEXT,
  creative_id TEXT,
  hypothesis_id TEXT,
  angle_id TEXT,
  aa_cid TEXT,
  wa_token TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  fbclid TEXT,
  fbc TEXT,
  fbp TEXT,
  referrer TEXT,
  landing_path TEXT,
  device_type TEXT,
  phone_normalized TEXT,
  client_ip TEXT,
  client_user_agent TEXT,
  first_touch_json JSONB,
  last_paid_touch_json JSONB,
  raw_snapshot_json JSONB,
  confirmed_form_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_attribution_reservaid_unique UNIQUE (reservaid),
  CONSTRAINT order_attribution_pedido_id_unique UNIQUE (pedido_id)
);

CREATE INDEX IF NOT EXISTS idx_order_attribution_ad_id
  ON public.order_attribution (ad_id);
CREATE INDEX IF NOT EXISTS idx_order_attribution_hypothesis_id
  ON public.order_attribution (hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_order_attribution_phone
  ON public.order_attribution (phone_normalized, confirmed_form_at DESC);

CREATE TABLE IF NOT EXISTS public.wa_attribution_tokens (
  token TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL,
  visitor_id TEXT,
  ad_id TEXT,
  adset_id TEXT,
  campaign_id TEXT,
  creative_id TEXT,
  hypothesis_id TEXT,
  angle_id TEXT,
  aa_cid TEXT,
  fbclid TEXT,
  fbc TEXT,
  fbp TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  phone_normalized TEXT,
  touch_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS public.ad_entities (
  id TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL,
  publisher TEXT NOT NULL CHECK (publisher IN ('meta_direct', 'pipeboard')),
  ad_account_id TEXT NOT NULL,
  account_currency TEXT NOT NULL DEFAULT 'USD',
  campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT,
  creative_id TEXT,
  meta_creative_id TEXT,
  aa_cid TEXT,
  hypothesis_id TEXT,
  angle_id TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  headline TEXT,
  primary_text TEXT,
  cta_label TEXT,
  destination_url TEXT,
  url_tags TEXT,
  preflight_status TEXT,
  payload_snapshot JSONB,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_entities_product_ad
  ON public.ad_entities (product_slug, ad_id);

CREATE TABLE IF NOT EXISTS public.autoads_research_dossiers (
  id TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'PY',
  product_truth_json JSONB,
  competitor_findings_json JSONB,
  competitor_source_summary JSONB,
  psychological_profile_json JSONB,
  awareness_level TEXT,
  market_sophistication INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.autoads_hypotheses (
  id TEXT PRIMARY KEY,
  dossier_id TEXT REFERENCES public.autoads_research_dossiers(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  hypothesis_code TEXT NOT NULL,
  angle_id TEXT NOT NULL,
  awareness_level TEXT NOT NULL,
  market_sophistication INTEGER NOT NULL DEFAULT 3,
  target_avatar TEXT NOT NULL,
  core_pain TEXT NOT NULL,
  deep_desire TEXT NOT NULL,
  objection_targeted TEXT NOT NULL,
  unique_mechanism_problem TEXT NOT NULL,
  unique_mechanism_solution TEXT NOT NULL,
  big_idea TEXT NOT NULL,
  promise TEXT NOT NULL,
  proof_type TEXT NOT NULL,
  hook_formula TEXT NOT NULL,
  test_variable TEXT NOT NULL,
  copy_framework TEXT NOT NULL,
  visual_archetype TEXT NOT NULL,
  primary_text_draft TEXT,
  headline_draft TEXT,
  cta_draft TEXT,
  ai_image_prompt TEXT,
  video_script_prompt TEXT,
  verdict TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meta_ads_daily_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_date DATE NOT NULL,
  ad_account_id TEXT NOT NULL,
  account_currency TEXT NOT NULL DEFAULT 'USD',
  campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  inline_link_clicks BIGINT NOT NULL DEFAULT 0,
  spend_raw NUMERIC NOT NULL DEFAULT 0,
  spend_usd NUMERIC NOT NULL DEFAULT 0,
  spend_pyg NUMERIC NOT NULL DEFAULT 0,
  meta_leads_reported BIGINT NOT NULL DEFAULT 0,
  cpm_usd NUMERIC DEFAULT 0,
  cpc_usd NUMERIC DEFAULT 0,
  ctr_pct NUMERIC DEFAULT 0,
  raw_actions_json JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meta_ads_daily_insights_unique UNIQUE (insight_date, ad_account_id, ad_id)
);

CREATE TABLE IF NOT EXISTS public.autoads_learning_memory (
  id TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'adset', 'ad', 'creative', 'hypothesis', 'angle', 'hook', 'format')),
  entity_id TEXT NOT NULL,
  angle_id TEXT,
  hypothesis_id TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('winner', 'promising', 'loser', 'insufficient_data')),
  forms_count INTEGER NOT NULL DEFAULT 0,
  inline_link_clicks INTEGER NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  spend_usd NUMERIC NOT NULL DEFAULT 0,
  spend_pyg NUMERIC NOT NULL DEFAULT 0,
  form_cvr_pct NUMERIC NOT NULL DEFAULT 0,
  cpf_usd NUMERIC,
  cpf_pyg NUMERIC,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  recommended_action TEXT,
  learned_pattern_summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- BLOQUE 2 / 4: TABLAS NUEVAS CIRCUITO B (LOGÍSTICA ERP, COSTOS, FX Y CAPI)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_cost_profiles (
  id TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unit_product_cost_pyg NUMERIC NOT NULL,
  packaging_cost_pyg NUMERIC NOT NULL DEFAULT 0,
  default_courier_delivery_fee_pyg NUMERIC NOT NULL DEFAULT 0,
  default_courier_return_fee_pyg NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fx_rate_periods (
  id TEXT PRIMARY KEY,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  usd_to_pyg_rate NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual_admin',
  meta_invoice_reference TEXT,
  meta_invoice_amount_usd NUMERIC,
  meta_invoice_amount_pyg NUMERIC,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courier_settlements (
  id TEXT PRIMARY KEY,
  courier_name TEXT NOT NULL,
  settlement_date DATE NOT NULL,
  reference_code TEXT,
  total_gross_collected_pyg NUMERIC NOT NULL DEFAULT 0,
  total_courier_fees_pyg NUMERIC NOT NULL DEFAULT 0,
  total_net_transferred_pyg NUMERIC NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  matched_order_ids_json JSONB,
  unmatched_rows_json JSONB,
  raw_source_type TEXT DEFAULT 'manual',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meta_capi_dispatch_log (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  pedido_id BIGINT,
  reservaid TEXT,
  pixel_id TEXT NOT NULL,
  circuit TEXT NOT NULL CHECK (circuit IN ('circuit_a_conversion', 'circuit_b_purchase')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed_retrying', 'dead_letter', 'skipped_window_expired_erp_only')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  event_time_unix BIGINT NOT NULL,
  payload_json JSONB,
  response_json JSONB,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meta_capi_dispatch_log_event_unique UNIQUE (event_id, event_name)
);

-- ============================================================================
-- BLOQUE 3 / 4: PERMISOS RLS DE LAS 11 TABLAS NUEVAS
-- ============================================================================
ALTER TABLE public.order_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_attribution_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autoads_research_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autoads_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_daily_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autoads_learning_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_cost_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rate_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_capi_dispatch_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'order_attribution',
    'wa_attribution_tokens',
    'ad_entities',
    'autoads_research_dossiers',
    'autoads_hypotheses',
    'meta_ads_daily_insights',
    'autoads_learning_memory',
    'product_cost_profiles',
    'fx_rate_periods',
    'courier_settlements',
    'meta_capi_dispatch_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- BLOQUE 4 / 4: COLUMNAS ADITIVAS E ÍNDICES EN public.pedidos
-- (Ejecutar al final como bloque independiente; si la app está sondeando, toma lock corto)
-- ============================================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS client_request_key TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_form_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canonical_conversion_event TEXT DEFAULT 'Lead',
  ADD COLUMN IF NOT EXISTS canonical_lead_event_id TEXT,
  ADD COLUMN IF NOT EXISTS attributed_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS attributed_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS attributed_adset_id TEXT,
  ADD COLUMN IF NOT EXISTS attributed_creative_id TEXT,
  ADD COLUMN IF NOT EXISTS attributed_hypothesis_id TEXT,
  ADD COLUMN IF NOT EXISTS attributed_angle_id TEXT,
  ADD COLUMN IF NOT EXISTS attribution_source_kind TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pendiente_envio',
  ADD COLUMN IF NOT EXISTS customer_payment_status TEXT DEFAULT 'pendiente_cobro',
  ADD COLUMN IF NOT EXISTS courier_settlement_status TEXT DEFAULT 'no_aplica',
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS net_cash_collected_pyg NUMERIC,
  ADD COLUMN IF NOT EXISTS courier_fee_pyg NUMERIC,
  ADD COLUMN IF NOT EXISTS courier_settlement_id TEXT,
  ADD COLUMN IF NOT EXISTS product_unit_cost_pyg NUMERIC,
  ADD COLUMN IF NOT EXISTS packaging_cost_pyg NUMERIC,
  ADD COLUMN IF NOT EXISTS return_cost_pyg NUMERIC,
  ADD COLUMN IF NOT EXISTS purchase_capi_status TEXT DEFAULT 'no_elegible';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_client_request_key_unique
  ON public.pedidos (client_request_key)
  WHERE client_request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_confirmed_form_at
  ON public.pedidos (confirmed_form_at DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_attributed_ad_id
  ON public.pedidos (attributed_ad_id);
