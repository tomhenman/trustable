-- Migration 004: Agent Copilot, Integrations, Reviews, Data Retention
-- Fills all remaining gaps

-- ===========================================
-- AGENT USAGE TRACKING
-- ===========================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS agent_messages_today INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS agent_messages_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Agent message limits by plan
CREATE OR REPLACE FUNCTION get_agent_message_limit(p_plan plan_tier)
RETURNS INT AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'FREE' THEN 0
    WHEN 'STARTER' THEN 20
    WHEN 'PROFESSIONAL' THEN 100
    WHEN 'SCALE' THEN 500
    WHEN 'CUSTOM' THEN -1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check and increment agent usage
CREATE OR REPLACE FUNCTION check_agent_usage(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, current_usage INT, limit_value INT, remaining INT) AS $$
DECLARE
  v_plan plan_tier;
  v_usage INT;
  v_limit INT;
  v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current values and lock
  SELECT plan, agent_messages_today, agent_messages_reset_at
  INTO v_plan, v_usage, v_reset_at
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Reset if new day
  IF v_reset_at < CURRENT_DATE THEN
    v_usage := 0;
    UPDATE user_profiles
    SET agent_messages_today = 0, agent_messages_reset_at = NOW()
    WHERE id = p_user_id;
  END IF;
  
  v_limit := get_agent_message_limit(v_plan);
  
  -- Check limit
  IF v_limit = -1 OR v_usage < v_limit THEN
    -- Increment
    UPDATE user_profiles
    SET agent_messages_today = agent_messages_today + 1
    WHERE id = p_user_id;
    
    RETURN QUERY SELECT 
      TRUE,
      v_usage + 1,
      v_limit,
      CASE WHEN v_limit = -1 THEN -1 ELSE v_limit - v_usage - 1 END;
  ELSE
    RETURN QUERY SELECT 
      FALSE,
      v_usage,
      v_limit,
      0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- AGENT TOOL AUDIT LOG
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_tool_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  
  status TEXT NOT NULL DEFAULT 'executed', -- executed, refused, error
  refusal_reason TEXT,
  error_message TEXT,
  
  execution_time_ms INT,
  tokens_used INT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tool_audit_thread ON agent_tool_audit(thread_id);
CREATE INDEX idx_tool_audit_user ON agent_tool_audit(user_id);
CREATE INDEX idx_tool_audit_tool ON agent_tool_audit(tool_name);

-- ===========================================
-- GA4 INTEGRATION
-- ===========================================

CREATE TABLE IF NOT EXISTS ga4_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  property_id TEXT NOT NULL,
  property_name TEXT,
  
  -- Token storage (encrypted by frontend before storing)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'connected', -- connected, expired, error
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

CREATE TABLE IF NOT EXISTS ga4_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  
  -- Traffic metrics
  sessions INT,
  users INT,
  new_users INT,
  page_views INT,
  
  -- Engagement
  avg_session_duration DECIMAL(10, 2),
  bounce_rate DECIMAL(5, 2),
  pages_per_session DECIMAL(5, 2),
  
  -- Sources
  organic_sessions INT,
  direct_sessions INT,
  referral_sessions INT,
  social_sessions INT,
  
  -- AI attribution (estimated)
  ai_attributed_sessions INT,
  ai_attributed_conversions INT,
  
  -- Conversions
  conversions INT,
  conversion_value DECIMAL(12, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, date)
);

CREATE INDEX idx_ga4_metrics_business ON ga4_metrics(business_id);
CREATE INDEX idx_ga4_metrics_date ON ga4_metrics(date DESC);

-- Per-page GA4 metrics
CREATE TABLE IF NOT EXISTS ga4_page_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  
  page_views INT,
  unique_page_views INT,
  avg_time_on_page DECIMAL(10, 2),
  entrances INT,
  exits INT,
  bounce_rate DECIMAL(5, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, date, page_path)
);

CREATE INDEX idx_ga4_page_metrics_business ON ga4_page_metrics(business_id);

-- ===========================================
-- GOOGLE SEARCH CONSOLE INTEGRATION
-- ===========================================

CREATE TABLE IF NOT EXISTS gsc_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  site_url TEXT NOT NULL,
  
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'connected',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

CREATE TABLE IF NOT EXISTS gsc_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  
  -- Aggregate metrics
  clicks INT,
  impressions INT,
  ctr DECIMAL(5, 4),
  avg_position DECIMAL(5, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, date)
);

-- Per-page GSC metrics
CREATE TABLE IF NOT EXISTS gsc_page_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  page_url TEXT NOT NULL,
  
  clicks INT,
  impressions INT,
  ctr DECIMAL(5, 4),
  avg_position DECIMAL(5, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, date, page_url)
);

-- Per-query GSC metrics
CREATE TABLE IF NOT EXISTS gsc_query_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  query TEXT NOT NULL,
  
  clicks INT,
  impressions INT,
  ctr DECIMAL(5, 4),
  avg_position DECIMAL(5, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, date, query)
);

CREATE INDEX idx_gsc_page_metrics_business ON gsc_page_metrics(business_id);
CREATE INDEX idx_gsc_query_metrics_business ON gsc_query_metrics(business_id);

-- ===========================================
-- EMAIL REPORTS
-- ===========================================

CREATE TYPE email_status AS ENUM ('queued', 'sending', 'sent', 'failed', 'bounced');

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Sender/recipient
  to_email TEXT NOT NULL,
  to_name TEXT,
  from_email TEXT DEFAULT 'reports@trustable.ai',
  from_name TEXT DEFAULT 'Trustable',
  reply_to TEXT,
  
  -- Content
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  
  -- Metadata
  email_type TEXT NOT NULL, -- report, alert, digest, welcome
  related_id UUID, -- report_run_id, alert_id, etc.
  
  -- Status
  status email_status DEFAULT 'queued',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  
  -- Tracking
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  
  -- Errors
  last_error TEXT,
  error_code TEXT,
  
  -- Metadata for handoff
  external_id TEXT, -- ID from email provider
  provider TEXT, -- resend, sendgrid, etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON email_queue(status) WHERE status = 'queued';
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_at) WHERE status = 'queued';

-- ===========================================
-- EXTERNAL REVIEWS
-- ===========================================

CREATE TYPE review_platform AS ENUM (
  'google', 'yelp', 'trustpilot', 'facebook', 'tripadvisor', 'bbb', 'g2', 'capterra'
);

CREATE TABLE IF NOT EXISTS review_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  platform review_platform NOT NULL,
  platform_business_id TEXT, -- ID on the review platform
  platform_url TEXT,
  
  -- Credentials (if any, encrypted)
  api_key_encrypted TEXT,
  
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, platform)
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES review_connections(id) ON DELETE SET NULL,
  
  platform review_platform NOT NULL,
  platform_review_id TEXT,
  
  -- Review content
  author_name TEXT,
  author_avatar_url TEXT,
  rating DECIMAL(2, 1), -- 1.0 to 5.0
  title TEXT,
  content TEXT,
  
  -- Sentiment (calculated)
  sentiment sentiment_type,
  sentiment_score DECIMAL(4, 3),
  
  -- Extracted themes
  themes TEXT[],
  key_phrases TEXT[],
  is_negative_spike BOOLEAN DEFAULT false,
  
  -- Response
  has_response BOOLEAN DEFAULT false,
  response_text TEXT,
  response_date TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  review_date TIMESTAMP WITH TIME ZONE,
  verified_purchase BOOLEAN,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(platform, platform_review_id)
);

CREATE INDEX idx_reviews_business ON reviews(business_id);
CREATE INDEX idx_reviews_platform ON reviews(platform);
CREATE INDEX idx_reviews_sentiment ON reviews(sentiment);
CREATE INDEX idx_reviews_date ON reviews(review_date DESC);

-- Review aggregates
CREATE TABLE IF NOT EXISTS review_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  period TEXT NOT NULL, -- 'all', '2024-01', etc.
  
  total_reviews INT DEFAULT 0,
  average_rating DECIMAL(3, 2),
  
  -- Distribution
  five_star INT DEFAULT 0,
  four_star INT DEFAULT 0,
  three_star INT DEFAULT 0,
  two_star INT DEFAULT 0,
  one_star INT DEFAULT 0,
  
  -- Sentiment
  positive_count INT DEFAULT 0,
  neutral_count INT DEFAULT 0,
  negative_count INT DEFAULT 0,
  
  -- By platform
  by_platform JSONB,
  
  -- Trends
  previous_period_rating DECIMAL(3, 2),
  rating_change DECIMAL(3, 2),
  
  -- Risk indicators
  negative_spike_detected BOOLEAN DEFAULT false,
  recurring_complaint_themes TEXT[],
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, period)
);

-- ===========================================
-- API KEYS (Logical Model)
-- ===========================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  
  -- Key hash (actual key shown once, then hashed)
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  key_hash TEXT NOT NULL,
  
  -- Permissions
  scopes TEXT[] DEFAULT '{}', -- read, write, admin
  allowed_endpoints TEXT[], -- null = all endpoints
  
  -- Rate limits
  requests_per_minute INT DEFAULT 60,
  requests_per_day INT DEFAULT 10000,
  
  -- Usage tracking
  last_used_at TIMESTAMP WITH TIME ZONE,
  total_requests INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- API request log
CREATE TABLE IF NOT EXISTS api_request_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  
  status_code INT,
  response_time_ms INT,
  
  request_body_size INT,
  response_body_size INT,
  
  ip_address INET,
  user_agent TEXT,
  
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_log_key ON api_request_log(api_key_id);
CREATE INDEX idx_api_log_created ON api_request_log(created_at DESC);

-- ===========================================
-- AUDIT LOG (General)
-- ===========================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL, -- create, update, delete, view, export
  resource_type TEXT NOT NULL, -- business, scan, content, etc.
  resource_id UUID,
  
  -- Change details
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ===========================================
-- DATA RETENTION
-- ===========================================

-- Retention policies by plan
CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  plan plan_tier NOT NULL UNIQUE,
  
  -- Retention windows (days, -1 = unlimited)
  scan_results_days INT NOT NULL,
  audit_results_days INT NOT NULL,
  prompt_results_days INT NOT NULL,
  agent_threads_days INT NOT NULL,
  api_logs_days INT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default policies
INSERT INTO retention_policies (plan, scan_results_days, audit_results_days, prompt_results_days, agent_threads_days, api_logs_days)
VALUES 
  ('FREE', 30, 30, 30, 7, 7),
  ('STARTER', 90, 90, 90, 30, 30),
  ('PROFESSIONAL', 365, 365, 365, 90, 90),
  ('SCALE', -1, -1, -1, 365, 365),
  ('CUSTOM', -1, -1, -1, -1, -1)
ON CONFLICT (plan) DO NOTHING;

-- Purge function
CREATE OR REPLACE FUNCTION purge_expired_data()
RETURNS TABLE(
  table_name TEXT,
  rows_deleted INT
) AS $$
DECLARE
  v_policy RECORD;
  v_cutoff TIMESTAMP WITH TIME ZONE;
  v_deleted INT;
BEGIN
  -- Process each plan's data
  FOR v_policy IN SELECT * FROM retention_policies WHERE plan != 'CUSTOM' LOOP
    
    -- Scan results
    IF v_policy.scan_results_days > 0 THEN
      v_cutoff := NOW() - (v_policy.scan_results_days || ' days')::INTERVAL;
      
      DELETE FROM prompt_results
      WHERE created_at < v_cutoff
        AND business_id IN (
          SELECT b.id FROM businesses b
          JOIN user_profiles up ON b.user_id = up.id
          WHERE up.plan = v_policy.plan
        );
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      
      IF v_deleted > 0 THEN
        table_name := 'prompt_results';
        rows_deleted := v_deleted;
        RETURN NEXT;
      END IF;
    END IF;
    
    -- Agent threads
    IF v_policy.agent_threads_days > 0 THEN
      v_cutoff := NOW() - (v_policy.agent_threads_days || ' days')::INTERVAL;
      
      DELETE FROM agent_threads
      WHERE created_at < v_cutoff
        AND user_id IN (
          SELECT id FROM user_profiles WHERE plan = v_policy.plan
        );
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      
      IF v_deleted > 0 THEN
        table_name := 'agent_threads';
        rows_deleted := v_deleted;
        RETURN NEXT;
      END IF;
    END IF;
    
    -- API logs
    IF v_policy.api_logs_days > 0 THEN
      v_cutoff := NOW() - (v_policy.api_logs_days || ' days')::INTERVAL;
      
      DELETE FROM api_request_log
      WHERE created_at < v_cutoff
        AND api_key_id IN (
          SELECT ak.id FROM api_keys ak
          JOIN user_profiles up ON ak.user_id = up.id
          WHERE up.plan = v_policy.plan
        );
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      
      IF v_deleted > 0 THEN
        table_name := 'api_request_log';
        rows_deleted := v_deleted;
        RETURN NEXT;
      END IF;
    END IF;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- RLS POLICIES
-- ===========================================

ALTER TABLE agent_tool_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_page_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_page_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_query_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- User can see own data
CREATE POLICY "Users view own tool audit" ON agent_tool_audit FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users view own GA4" ON ga4_connections FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users view own reviews" ON reviews FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own API keys" ON api_keys FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users view own audit log" ON audit_log FOR SELECT
  USING (user_id = auth.uid());
