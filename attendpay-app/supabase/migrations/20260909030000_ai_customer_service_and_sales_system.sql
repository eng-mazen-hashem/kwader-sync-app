-- =========================================================================
-- Migration: AI Customer Service & Sales Agent System
-- =========================================================================

-- 1. Extend whatsapp_channels with AI Agent Configuration
ALTER TABLE whatsapp_channels 
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_mode text DEFAULT 'hybrid', -- 'sales', 'support', 'hybrid'
ADD COLUMN IF NOT EXISTS ai_name text DEFAULT 'مساعد كوادر الذكي',
ADD COLUMN IF NOT EXISTS ai_greeting text DEFAULT 'أهلاً بك في منصة كوادر! 👋 كيف يمكنني مساعدتك اليوم؟',
ADD COLUMN IF NOT EXISTS ai_prompt_instructions text,
ADD COLUMN IF NOT EXISTS ai_auto_handoff_keywords text[] DEFAULT ARRAY['بشري', 'انسان', 'موظف', 'خدمة عملاء', 'مشكلة كبيرة', 'اريد التحدث مع شخص', 'شكوى'];

-- 2. Create AI Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
    company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    platform text DEFAULT 'whatsapp', -- 'whatsapp', 'web'
    session_id text NOT NULL, -- phone number or web session ID
    customer_name text,
    customer_phone text,
    status text DEFAULT 'ai_active', -- 'ai_active', 'human_takeover', 'resolved'
    lead_status text DEFAULT 'none', -- 'none', 'lead_captured', 'converted'
    summary text,
    context_state jsonb DEFAULT '{}'::jsonb,
    last_message_at timestamptz DEFAULT clock_timestamp(),
    created_at timestamptz DEFAULT clock_timestamp(),
    updated_at timestamptz DEFAULT clock_timestamp()
);

-- Unique index to quickly lookup active session by platform and session_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversations_platform_session 
ON ai_conversations(platform, session_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_channel_status 
ON ai_conversations(channel_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_company 
ON ai_conversations(company_id);

-- 3. Create AI Messages Table
CREATE TABLE IF NOT EXISTS ai_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    sender_type text NOT NULL, -- 'user', 'ai', 'human_agent'
    message_text text NOT NULL,
    tokens_used int DEFAULT 0,
    created_at timestamptz DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created 
ON ai_messages(conversation_id, created_at ASC);

-- 4. Create AI Knowledge Base Table
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE, -- NULL = Platform-wide (KWADER)
    category text DEFAULT 'faq', -- 'pricing', 'features', 'attendance_devices', 'payroll_rules', 'faq', 'support'
    question_trigger text NOT NULL,
    answer_content text NOT NULL,
    keywords text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT clock_timestamp(),
    updated_at timestamptz DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_category 
ON ai_knowledge_base(category, is_active);

-- Populate Initial Platform Knowledge Base for KWADER
INSERT INTO ai_knowledge_base (category, question_trigger, answer_content, keywords)
SELECT 'pricing', 'ما هي أسعار وباقات منصة كوادر؟', 
'توفر منصة كوادر باقات مرنة تناسب الشركات من جميع الأحجام:
- الباقة الأساسية: لإدارة الحضور والرواتب السحابية لأجهزة البصمة.
- الباقة المتقدمة: تدعم الورديات المتعددة، السلف والأقساط، والتقارير المتقدمة.
- الباقة المؤسسية: تشمل الربط اللامركزي للواتساب وفروع غير محدودة ودعم فني مخصص.
نقدم فترة تجريبية مجانية بالكامل لاختبار المنصة مع أجهزتكم الحالية.', 
ARRAY['اسعار', 'سعر', 'باقات', 'باقة', 'اشتراك', 'تكلفة', 'تجربة', 'تجريبي']
WHERE NOT EXISTS (SELECT 1 FROM ai_knowledge_base WHERE category = 'pricing' LIMIT 1);

INSERT INTO ai_knowledge_base (category, question_trigger, answer_content, keywords)
SELECT 'features', 'ما هي أهم مميزات منصة كوادر لإدارة الموارد البشرية؟', 
'منصة كوادر تقدم حلولاً متكاملة تشمل:
1. ربط أجهزة البصمة (ZKTeco وغيرها) ومزامنة الحضور آلياً دون الحاجة لـ IP ثابت.
2. احتساب الرواتب والبدلات والخصومات بدقة متناهية وبضغطة زر.
3. بوابة خدمة ذاتية للموظفين عبر الجوال لطلب الإجازات والسلف.
4. إرسال إشعارات الحضور وقسائم الرواتب عبر الواتساب مباشرة.
5. دعم كامل لضريبة الدخل والتأمينات الاجتماعية وقوانين العمل.', 
ARRAY['مميزات', 'ميزات', 'خصائص', 'حضور', 'رواتب', 'بصمة', 'zkteco', 'سلف', 'اجازات']
WHERE NOT EXISTS (SELECT 1 FROM ai_knowledge_base WHERE category = 'features' LIMIT 1);

INSERT INTO ai_knowledge_base (category, question_trigger, answer_content, keywords)
SELECT 'support', 'كيف يمكنني ربط أجهزة البصمة الخاصة بي؟', 
'يمكن ربط أجهزة البصمة بكل سهولة عبر تطبيق المزامنة (KWADER Sync Agent) الذي يعمل كخدمة في الخلفية على أي جهاز بالشبكة المحلية، ويسحب الحركات لحظياً ويرفعها سحابياً بأمان تام دون فتح أي منافذ خارجية في الراوتر.', 
ARRAY['ربط', 'جهاز', 'بصمة', 'سحب', 'مزامنة', 'sync', 'zk']
WHERE NOT EXISTS (SELECT 1 FROM ai_knowledge_base WHERE category = 'support' LIMIT 1);

-- 5. Create AI Leads Table (CRM Pipeline)
CREATE TABLE IF NOT EXISTS ai_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
    channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
    company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    contact_name text,
    contact_phone text,
    company_name text,
    employee_count int,
    interested_products text[] DEFAULT '{}'::text[],
    customer_notes text,
    status text DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'closed_won', 'closed_lost'
    created_at timestamptz DEFAULT clock_timestamp(),
    updated_at timestamptz DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_ai_leads_status_created 
ON ai_leads(status, created_at DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_leads ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DO $$
BEGIN
    -- ai_conversations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_conversations' AND policyname = 'Allow public read ai_conversations') THEN
        CREATE POLICY "Allow public read ai_conversations" ON ai_conversations FOR SELECT TO anon, authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_conversations' AND policyname = 'Allow all write ai_conversations') THEN
        CREATE POLICY "Allow all write ai_conversations" ON ai_conversations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    -- ai_messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_messages' AND policyname = 'Allow public read ai_messages') THEN
        CREATE POLICY "Allow public read ai_messages" ON ai_messages FOR SELECT TO anon, authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_messages' AND policyname = 'Allow all write ai_messages') THEN
        CREATE POLICY "Allow all write ai_messages" ON ai_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    -- ai_knowledge_base
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_knowledge_base' AND policyname = 'Allow public read ai_knowledge_base') THEN
        CREATE POLICY "Allow public read ai_knowledge_base" ON ai_knowledge_base FOR SELECT TO anon, authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_knowledge_base' AND policyname = 'Allow all write ai_knowledge_base') THEN
        CREATE POLICY "Allow all write ai_knowledge_base" ON ai_knowledge_base FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    -- ai_leads
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_leads' AND policyname = 'Allow public read ai_leads') THEN
        CREATE POLICY "Allow public read ai_leads" ON ai_leads FOR SELECT TO anon, authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_leads' AND policyname = 'Allow all write ai_leads') THEN
        CREATE POLICY "Allow all write ai_leads" ON ai_leads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
