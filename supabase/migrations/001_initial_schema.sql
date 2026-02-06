-- Trustable Database Schema
-- Complete schema for AI Trust & Visibility Platform

-- ===========================================
-- EXTENSIONS
-- ===========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ===========================================
-- USERS & PLANS
-- ===========================================

CREATE TYPE plan_tier AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'SCALE', 'CUSTOM');

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company_name TEXT,
  plan plan_tier DEFAULT 'FREE',
  stripe_customer_id TEXT,
  
  -- Plan limits tracking
  prompts_used_this_month INT DEFAULT 0,
  answers_used_this_month INT DEFAULT 0,
  articles_used_this_month INT DEFAULT 0,
  audits_used_this_month INT DEFAULT 0,
  usage_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Preferences
  digest_enabled BOOLEAN DEFAULT true,
  digest_frequency TEXT DEFAULT 'weekly',
  alert_email BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- BUSINESSES
-- ===========================================

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  category TEXT,
  subcategory TEXT,
  industry TEXT,
  founded_year INT,
  
  -- Location
  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  postal_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  service_area TEXT[],
  
  -- Contact
  phone TEXT,
  email TEXT,
  
  -- Social & Online
  google_place_id TEXT,
  google_business_url TEXT,
  facebook_url TEXT,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  twitter_handle TEXT,
  linkedin_url TEXT,
  youtube_channel TEXT,
  
  -- Review Platforms
  yelp_id TEXT,
  trustpilot_id TEXT,
  
  -- Tracking Config
  keywords TEXT[] DEFAULT '{}',
  products TEXT[] DEFAULT '{}',
  services TEXT[] DEFAULT '{}',
  competitors TEXT[] DEFAULT '{}',
  target_audience TEXT[] DEFAULT '{}',
  brand_variations TEXT[] DEFAULT '{}',
  
  -- Settings
  monitoring_frequency TEXT DEFAULT 'daily',
  monitoring_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_businesses_user ON businesses(user_id);

-- ===========================================
-- TRACKED PROMPTS
-- ===========================================

CREATE TYPE query_type AS ENUM (
  'BRAND_DIRECT', 'CATEGORY_SEARCH', 'RECOMMENDATION', 'COMPARISON',
  'REVIEW_INQUIRY', 'LOCAL_SEARCH', 'PRODUCT_SEARCH', 'SERVICE_INQUIRY',
  'PRICING_INQUIRY', 'ALTERNATIVE_SEARCH', 'INDUSTRY_LEADER', 'TRUST_VERIFICATION'
);

CREATE TABLE tracked_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  prompt TEXT NOT NULL,
  query_type query_type NOT NULL,
  priority TEXT DEFAULT 'MEDIUM',
  
  -- Targeting
  target_region TEXT,
  target_language TEXT DEFAULT 'en',
  
  -- Scheduling
  frequency TEXT DEFAULT 'daily',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompts_business ON tracked_prompts(business_id);
CREATE INDEX idx_prompts_next_run ON tracked_prompts(next_run_at) WHERE is_active = true;

-- ===========================================
-- PROMPT RESULTS (AI RESPONSES)
-- ===========================================

CREATE TYPE ai_platform AS ENUM (
  'chatgpt', 'claude', 'perplexity', 'google_ai', 'copilot', 'gemini', 'grok', 'deepseek'
);

CREATE TYPE mention_type AS ENUM (
  'PRIMARY', 'FEATURED', 'LISTED', 'BRIEF', 'COMPARISON', 'CITATION', 'NEGATIVE', 'ABSENT'
);

CREATE TYPE sentiment_type AS ENUM (
  'VERY_POSITIVE', 'POSITIVE', 'NEUTRAL', 'CAUTIOUS', 'NEGATIVE', 'VERY_NEGATIVE'
);

CREATE TABLE prompt_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID REFERENCES tracked_prompts(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scan_id UUID,  -- Links to scans table
  
  platform ai_platform NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  
  -- Analysis Results
  mentioned BOOLEAN DEFAULT false,
  mention_type mention_type,
  mention_context TEXT,
  mention_count INT DEFAULT 0,
  
  sentiment sentiment_type,
  sentiment_score DECIMAL(4, 3),  -- -1 to 1
  confidence_score DECIMAL(4, 3), -- 0 to 1
  
  has_hedging BOOLEAN DEFAULT false,
  hedging_phrases TEXT[],
  
  is_recommended BOOLEAN DEFAULT false,
  recommendation_strength TEXT,
  
  ranking INT,
  cited_url TEXT,
  cited_sources TEXT[],
  competitors_mentioned TEXT[],
  
  key_phrases TEXT[],
  positive_indicators TEXT[],
  negative_indicators TEXT[],
  
  -- Metadata
  response_time_ms INT,
  token_count INT,
  model_used TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_results_business ON prompt_results(business_id);
CREATE INDEX idx_results_platform ON prompt_results(platform);
CREATE INDEX idx_results_created ON prompt_results(created_at DESC);
CREATE INDEX idx_results_scan ON prompt_results(scan_id);

-- ===========================================
-- SCANS
-- ===========================================

CREATE TYPE scan_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE scan_type AS ENUM ('FULL', 'QUICK', 'COMPETITOR', 'LOCAL', 'SCHEDULED');

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  scan_type scan_type DEFAULT 'FULL',
  status scan_status DEFAULT 'PENDING',
  
  platforms ai_platform[] DEFAULT '{chatgpt}',
  prompts_count INT DEFAULT 0,
  results_count INT DEFAULT 0,
  
  -- Results Summary
  scores JSONB,
  breakdowns JSONB,
  highlights TEXT[],
  critical_issues TEXT[],
  
  error_message TEXT,
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scans_business ON scans(business_id);
CREATE INDEX idx_scans_status ON scans(status);

-- ===========================================
-- SCORES (Historical)
-- ===========================================

CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  
  -- All scores (0-100)
  overall_score INT,
  ai_trust_score INT,
  ai_visibility_score INT,
  ai_recommendation_score INT,
  ai_citation_score INT,
  sentiment_score INT,
  confidence_score INT,
  local_visibility_score INT,
  social_discovery_score INT,
  review_strength_score INT,
  website_optimization_score INT,
  technical_readiness_score INT,
  category_authority_score INT,
  share_of_voice DECIMAL(5, 2),
  
  -- Breakdowns stored as JSON
  breakdowns JSONB,
  
  -- Change tracking
  previous_score_id UUID REFERENCES scores(id),
  overall_change INT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scores_business ON scores(business_id);
CREATE INDEX idx_scores_created ON scores(created_at DESC);

-- ===========================================
-- RECOMMENDATIONS
-- ===========================================

CREATE TYPE recommendation_category AS ENUM (
  'WEBSITE_CONTENT', 'TECHNICAL_SEO', 'SCHEMA_MARKUP', 'REVIEW_GENERATION',
  'SOCIAL_PRESENCE', 'LOCAL_OPTIMIZATION', 'AUTHORITY_BUILDING', 'CONTENT_CREATION',
  'CITATION_BUILDING', 'PROFILE_COMPLETION', 'COMPETITOR_RESPONSE', 'CRISIS_MANAGEMENT'
);

CREATE TYPE recommendation_priority AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE recommendation_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'SNOOZED');

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  category recommendation_category NOT NULL,
  priority recommendation_priority NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT,
  
  action_steps JSONB,  -- Array of {order, title, description, isCompleted}
  
  generated_content TEXT,
  template TEXT,
  
  impact_areas TEXT[],
  estimated_impact INT,
  estimated_effort TEXT,
  estimated_time_minutes INT,
  
  status recommendation_status DEFAULT 'PENDING',
  completed_at TIMESTAMP WITH TIME ZONE,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_recommendations_business ON recommendations(business_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_priority ON recommendations(priority);

-- ===========================================
-- GENERATED CONTENT
-- ===========================================

CREATE TYPE content_type AS ENUM (
  'ABOUT_PAGE', 'SERVICE_PAGE', 'PRODUCT_PAGE', 'FAQ_PAGE', 'BLOG_POST',
  'LANDING_PAGE', 'META_DESCRIPTION', 'SOCIAL_POST', 'TIKTOK_SCRIPT',
  'EMAIL', 'REVIEW_REQUEST', 'CASE_STUDY', 'PRESS_RELEASE'
);

CREATE TYPE content_status AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  content_type content_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  word_count INT,
  reading_time_minutes INT,
  
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT[],
  
  ai_optimization_score INT,
  ai_optimization_notes TEXT[],
  
  status content_status DEFAULT 'DRAFT',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_content_business ON generated_content(business_id);
CREATE INDEX idx_content_type ON generated_content(content_type);

-- ===========================================
-- SITE AUDITS
-- ===========================================

CREATE TABLE site_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  
  -- Scores
  overall_score INT,
  technical_score INT,
  content_score INT,
  schema_score INT,
  crawlability_score INT,
  
  -- Issues (stored as JSONB arrays)
  critical_issues JSONB,
  warnings JSONB,
  passed_checks JSONB,
  
  -- Page analysis
  pages_analyzed INT,
  page_results JSONB,
  
  -- Schema
  schema_types TEXT[],
  missing_schema TEXT[],
  
  status scan_status DEFAULT 'PENDING',
  error_message TEXT,
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audits_business ON site_audits(business_id);

-- ===========================================
-- COMPETITOR BENCHMARKS
-- ===========================================

CREATE TABLE competitor_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  competitor_name TEXT NOT NULL,
  
  -- Estimated scores
  estimated_scores JSONB,
  
  -- Differences (positive = you're ahead)
  visibility_diff INT,
  trust_diff INT,
  recommendation_diff INT,
  sentiment_diff INT,
  
  -- Analysis
  strength_areas TEXT[],
  weakness_areas TEXT[],
  insights TEXT[],
  
  their_citations TEXT[],
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, competitor_name)
);

CREATE INDEX idx_benchmarks_business ON competitor_benchmarks(business_id);

-- ===========================================
-- SHARE OF VOICE
-- ===========================================

CREATE TABLE share_of_voice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  period TEXT NOT NULL,  -- e.g., '2024-01' for monthly
  
  total_mentions INT,
  positive_mentions INT,
  recommendations INT,
  category_total_mentions INT,
  
  share_of_voice DECIMAL(5, 2),
  share_of_recommendations DECIMAL(5, 2),
  
  by_platform JSONB,
  competitor_shares JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, period)
);

-- ===========================================
-- ALERTS
-- ===========================================

CREATE TYPE alert_type AS ENUM (
  'SCORE_DROP', 'SCORE_IMPROVEMENT', 'VISIBILITY_LOST', 'VISIBILITY_GAINED',
  'NEW_NEGATIVE_MENTION', 'NEW_POSITIVE_MENTION', 'COMPETITOR_OVERTAKE',
  'CITATION_ADDED', 'CITATION_LOST', 'RANKING_CHANGE', 'SHARE_OF_VOICE_CHANGE',
  'RECOMMENDATION_URGENT', 'AUDIT_CRITICAL'
);

CREATE TYPE alert_severity AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'POSITIVE');

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  alert_type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  
  action_url TEXT,
  action_label TEXT,
  
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_business ON alerts(business_id);
CREATE INDEX idx_alerts_read ON alerts(read) WHERE read = false;

-- ===========================================
-- WEEKLY DIGESTS
-- ===========================================

CREATE TABLE weekly_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  current_scores JSONB,
  previous_scores JSONB,
  score_changes JSONB,
  
  total_prompt_runs INT,
  total_mentions INT,
  
  highlights TEXT[],
  concerns TEXT[],
  
  share_of_voice DECIMAL(5, 2),
  share_of_voice_change DECIMAL(5, 2),
  
  competitor_movements JSONB,
  
  completed_recommendations INT,
  pending_recommendations INT,
  
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INTEGRATIONS
-- ===========================================

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  platform TEXT NOT NULL,  -- google_analytics, search_console, hubspot, etc.
  status TEXT DEFAULT 'connected',
  
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  config JSONB,
  
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- AI TRAFFIC (Attribution)
-- ===========================================

CREATE TABLE ai_traffic (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  estimated_source ai_platform,
  referrer_url TEXT,
  landing_page TEXT,
  
  session_id TEXT,
  page_views INT,
  time_on_site INT,
  
  converted BOOLEAN DEFAULT false,
  conversion_type TEXT,
  conversion_value DECIMAL(10, 2),
  
  device TEXT,
  country TEXT,
  city TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_traffic_business ON ai_traffic(business_id);
CREATE INDEX idx_traffic_created ON ai_traffic(created_at DESC);

-- ===========================================
-- TRUST BADGES
-- ===========================================

CREATE TYPE badge_tier AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

CREATE TABLE trust_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  is_eligible BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  
  tier badge_tier,
  current_score INT,
  min_score INT DEFAULT 70,
  
  requirements_met TEXT[],
  requirements_not_met TEXT[],
  
  badge_url TEXT,
  embed_code TEXT,
  
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_of_voice ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_traffic ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_badges ENABLE ROW LEVEL SECURITY;

-- User can only see their own data
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own businesses" ON businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own businesses" ON businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own businesses" ON businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own businesses" ON businesses FOR DELETE USING (auth.uid() = user_id);

-- Business-related tables (check via business ownership)
CREATE POLICY "Users can view own prompts" ON tracked_prompts FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own prompts" ON tracked_prompts FOR ALL 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own results" ON prompt_results FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own scans" ON scans FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own scores" ON scores FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own recommendations" ON recommendations FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own recommendations" ON recommendations FOR UPDATE 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own content" ON generated_content FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own content" ON generated_content FOR ALL 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own audits" ON site_audits FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own benchmarks" ON competitor_benchmarks FOR SELECT 
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own alerts" ON alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON alerts FOR UPDATE USING (auth.uid() = user_id);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_generated_content_updated_at BEFORE UPDATE ON generated_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Reset monthly usage
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET 
    prompts_used_this_month = 0,
    answers_used_this_month = 0,
    articles_used_this_month = 0,
    audits_used_this_month = 0,
    usage_reset_at = NOW()
  WHERE usage_reset_at < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly reset (requires pg_cron)
-- SELECT cron.schedule('reset-monthly-usage', '0 0 1 * *', 'SELECT reset_monthly_usage()');
