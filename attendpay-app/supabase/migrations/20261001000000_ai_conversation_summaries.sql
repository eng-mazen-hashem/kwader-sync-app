-- Migration: 20261001000000_ai_conversation_summaries.sql
-- Phase 1: Smart Context Memory — Self-Learning AI Sales Agent
-- Creates conversation summary table and customer profile table for KWADER AI Agent

-- ══════════════════════════════════════════════════════════════
-- TABLE: ai_conversation_summaries
-- Stores AI-generated compact summaries of each conversation.
-- Enables cross-session context loading without sending raw messages.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
    customer_phone TEXT NOT NULL,

    -- AI-generated summary fields
    summary_text TEXT,
    key_facts JSONB DEFAULT '{}',
    -- e.g. {"employees": 10, "device_type": "ZKTeco", "industry": "retail", "budget": "tight"}
    objections_raised TEXT[] DEFAULT '{}',
    -- e.g. ["السعر غالي", "محتاج أفكر", "مش مقتنع"]
    interests_shown TEXT[] DEFAULT '{}',
    -- e.g. ["باقة starter", "تجربة مجانية", "ربط ZK"]
    deal_stage TEXT DEFAULT 'cold',
    -- cold | warm | hot | closed_won | closed_lost
    next_best_action TEXT,
    -- "اعرض التجربة المجانية" / "حدد ديمو بكرة"

    messages_count INT DEFAULT 0,
    last_summarized_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_phone ON public.ai_conversation_summaries(customer_phone);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_channel ON public.ai_conversation_summaries(channel_id);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_stage ON public.ai_conversation_summaries(deal_stage);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_updated ON public.ai_conversation_summaries(last_summarized_at DESC);

ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_summaries_service_all"
    ON public.ai_conversation_summaries FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "conv_summaries_anon_read"
    ON public.ai_conversation_summaries FOR SELECT
    TO anon, authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- TABLE: ai_customer_profiles
-- Persistent DNA profile per customer phone number.
-- Built automatically from conversation data across ALL sessions.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,

    -- Company info (extracted from conversations)
    company_name TEXT,
    company_size INT,           -- employees count
    industry TEXT,              -- retail / manufacturing / services / education / etc.
    device_types TEXT[] DEFAULT '{}',       -- ["ZKTeco F18", "Hikvision"]
    current_solution TEXT,      -- excel / competitor_name / nothing

    -- Buying behavior
    price_sensitivity TEXT DEFAULT 'medium',    -- low / medium / high
    decision_maker BOOLEAN DEFAULT true,
    preferred_contact_time TEXT,                -- morning / evening / anytime

    -- Sales funnel stage
    funnel_stage TEXT DEFAULT 'awareness',
    -- awareness → interest → consideration → intent → trial → closed_won / closed_lost
    total_conversations INT DEFAULT 1,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    lost_reason TEXT,

    -- Conversation style learning
    responds_well_to TEXT[] DEFAULT '{}',
    -- humor / price_comparison / trial_offer / technical_details / urgency
    avoid_topics TEXT[] DEFAULT '{}',
    -- long_lists / formal_tone / technical_jargon

    first_contact_at TIMESTAMPTZ DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_phone, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON public.ai_customer_profiles(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_stage ON public.ai_customer_profiles(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_channel ON public.ai_customer_profiles(channel_id);

ALTER TABLE public.ai_customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_profiles_service_all"
    ON public.ai_customer_profiles FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "customer_profiles_anon_read"
    ON public.ai_customer_profiles FOR SELECT
    TO anon, authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- TABLE: ai_sales_outcomes
-- Tracks win/loss results to enable weekly self-learning analysis.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_sales_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
    channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
    customer_phone TEXT NOT NULL,
    outcome TEXT NOT NULL,
    -- won / lost / trial_started / demo_booked / ghosted
    winning_techniques TEXT[] DEFAULT '{}',
    losing_reasons TEXT[] DEFAULT '{}',
    deal_value_egp NUMERIC,
    time_to_close_hours NUMERIC,
    messages_count INT,
    ai_contributed BOOLEAN DEFAULT true,    -- was AI the primary handler?
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_outcomes_phone ON public.ai_sales_outcomes(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sales_outcomes_outcome ON public.ai_sales_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_sales_outcomes_recorded ON public.ai_sales_outcomes(recorded_at DESC);

ALTER TABLE public.ai_sales_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_outcomes_service_all"
    ON public.ai_sales_outcomes FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "sales_outcomes_anon_read"
    ON public.ai_sales_outcomes FOR SELECT
    TO anon, authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- RPC: get_customer_context
-- Returns smart context for a given phone: summary + profile + recent stage
-- Used by server.js on every incoming message (single DB round-trip)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_customer_context(
    p_phone TEXT,
    p_channel_id UUID,
    p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_summary RECORD;
    v_profile RECORD;
    v_result JSONB;
BEGIN
    -- Fetch latest summary for this conversation
    SELECT summary_text, key_facts, objections_raised, interests_shown, deal_stage, next_best_action
    INTO v_summary
    FROM public.ai_conversation_summaries
    WHERE conversation_id = p_conversation_id
    LIMIT 1;

    -- Fetch customer profile
    SELECT company_name, company_size, industry, device_types, price_sensitivity,
           funnel_stage, total_conversations, responds_well_to, current_solution
    INTO v_profile
    FROM public.ai_customer_profiles
    WHERE customer_phone = p_phone AND (channel_id = p_channel_id OR channel_id IS NULL)
    LIMIT 1;

    v_result := jsonb_build_object(
        'has_summary', v_summary IS NOT NULL,
        'has_profile', v_profile IS NOT NULL,
        'summary', CASE WHEN v_summary IS NOT NULL THEN jsonb_build_object(
            'summary_text', v_summary.summary_text,
            'key_facts', COALESCE(v_summary.key_facts, '{}'),
            'objections_raised', COALESCE(to_jsonb(v_summary.objections_raised), '[]'),
            'interests_shown', COALESCE(to_jsonb(v_summary.interests_shown), '[]'),
            'deal_stage', v_summary.deal_stage,
            'next_best_action', v_summary.next_best_action
        ) ELSE NULL END,
        'profile', CASE WHEN v_profile IS NOT NULL THEN jsonb_build_object(
            'company_name', v_profile.company_name,
            'company_size', v_profile.company_size,
            'industry', v_profile.industry,
            'device_types', COALESCE(to_jsonb(v_profile.device_types), '[]'),
            'price_sensitivity', v_profile.price_sensitivity,
            'funnel_stage', v_profile.funnel_stage,
            'total_conversations', v_profile.total_conversations,
            'responds_well_to', COALESCE(to_jsonb(v_profile.responds_well_to), '[]'),
            'current_solution', v_profile.current_solution
        ) ELSE NULL END
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_context(TEXT, UUID, UUID) TO anon, authenticated, service_role;

COMMENT ON TABLE public.ai_conversation_summaries IS 'AI-generated compact summaries of WhatsApp conversations for cross-session context loading';
COMMENT ON TABLE public.ai_customer_profiles IS 'Persistent customer DNA profile built from conversation history for personalized AI responses';
COMMENT ON TABLE public.ai_sales_outcomes IS 'Win/loss tracking for weekly self-learning analysis by the AI sales agent';
COMMENT ON FUNCTION public.get_customer_context IS 'Single RPC to fetch customer summary + profile in one DB call (token-efficient context loading)';
