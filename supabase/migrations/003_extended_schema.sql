-- Migration 003: Extended Schema
-- Adds: Organizations, Workspaces, Agent Conversations, Report Definitions, Extended Audits

-- ===========================================
-- ORGANIZATIONS (Multi-tenant support)
-- ===========================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  
  -- Billing
  plan plan_tier DEFAULT 'FREE',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Limits (org-level override)
  max_users INT,
  max_domains INT,
  
  -- Settings
  white_label_enabled BOOLEAN DEFAULT false,
  white_label_name TEXT,
  white_label_logo_url TEXT,
  api_access_enabled BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization membership
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, admin, member, viewer
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- ===========================================
-- WORKSPACES & PROJECTS
-- ===========================================

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- If no org, personal workspace
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Context for agent
  brand_voice TEXT,
  target_audience TEXT,
  key_differentiators TEXT[],
  industry_context TEXT,
  
  -- Settings
  default_region TEXT DEFAULT 'US',
  default_language TEXT DEFAULT 'en',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT workspace_owner CHECK (organization_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- active, archived, completed
  
  -- Link to business
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  
  -- Project goals
  goals JSONB,
  target_scores JSONB,
  
  start_date DATE,
  target_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_workspace ON projects(workspace_id);

-- ===========================================
-- PROMPT GROUPS (Organize prompts)
-- ===========================================

CREATE TABLE IF NOT EXISTS prompt_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  intent_tag TEXT, -- brand, category, comparison, local, shopping, reputation
  
  is_default BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add group reference to tracked_prompts
ALTER TABLE tracked_prompts 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES prompt_groups(id) ON DELETE SET NULL;

-- ===========================================
-- AI ENGINE CONFIGS
-- ===========================================

CREATE TABLE IF NOT EXISTS ai_engine_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  platform ai_platform NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  
  -- API config
  api_base_url TEXT,
  default_model TEXT,
  available_models TEXT[],
  
  -- Defaults
  default_temperature DECIMAL(3, 2) DEFAULT 0.7,
  default_max_tokens INT DEFAULT 2000,
  default_system_prompt TEXT,
  
  -- Rate limits
  requests_per_minute INT,
  tokens_per_minute INT,
  
  -- Availability
  is_enabled BOOLEAN DEFAULT true,
  requires_custom_plan BOOLEAN DEFAULT false,
  
  -- Metadata
  last_tested_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active', -- active, degraded, down
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configs
INSERT INTO ai_engine_configs (platform, display_name, default_model, is_enabled, requires_custom_plan)
VALUES 
  ('chatgpt', 'ChatGPT', 'gpt-4-turbo-preview', true, false),
  ('claude', 'Claude', 'claude-3-5-sonnet-20241022', true, true),
  ('perplexity', 'Perplexity', 'llama-3.1-sonar-large-128k-online', true, false),
  ('gemini', 'Gemini', 'gemini-1.5-pro', true, false),
  ('copilot', 'Microsoft Copilot', 'gpt-4', true, true),
  ('grok', 'Grok', 'grok-2', true, true),
  ('deepseek', 'DeepSeek', 'deepseek-chat', true, true)
ON CONFLICT (platform) DO NOTHING;

-- ===========================================
-- EXTENDED AUDIT SCHEMA
-- ===========================================

-- Issue types
CREATE TYPE issue_type AS ENUM (
  'MISSING_TITLE', 'TITLE_TOO_SHORT', 'TITLE_TOO_LONG',
  'MISSING_META_DESC', 'META_DESC_TOO_SHORT', 'META_DESC_TOO_LONG',
  'MISSING_H1', 'MULTIPLE_H1', 'MISSING_H2',
  'THIN_CONTENT', 'DUPLICATE_CONTENT',
  'MISSING_SCHEMA', 'INVALID_SCHEMA', 'MISSING_LOCAL_SCHEMA',
  'MISSING_CANONICAL', 'BROKEN_CANONICAL',
  'MISSING_VIEWPORT', 'SLOW_LOAD', 'LARGE_PAGE',
  'BROKEN_LINKS', 'MISSING_ALT_TEXT',
  'NO_ROBOTS', 'BLOCKED_BY_ROBOTS',
  'NO_SITEMAP', 'SITEMAP_ERRORS'
);

CREATE TYPE issue_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- Audit pages
CREATE TABLE IF NOT EXISTS audit_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  
  url TEXT NOT NULL,
  path TEXT,
  
  -- Response
  status_code INT,
  response_time_ms INT,
  content_size_bytes INT,
  
  -- Content
  title TEXT,
  meta_description TEXT,
  h1_text TEXT,
  h1_count INT,
  h2_count INT,
  word_count INT,
  
  -- Technical
  has_canonical BOOLEAN,
  canonical_url TEXT,
  has_viewport BOOLEAN,
  has_robots_meta BOOLEAN,
  robots_directives TEXT[],
  
  -- Schema
  schema_types TEXT[],
  schema_valid BOOLEAN,
  schema_errors TEXT[],
  
  -- Links
  internal_links INT,
  external_links INT,
  broken_links INT,
  
  -- Images
  images_count INT,
  images_without_alt INT,
  
  -- Score
  page_score INT,
  
  crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_pages_audit ON audit_pages(audit_id);

-- Audit issues
CREATE TABLE IF NOT EXISTS audit_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  page_id UUID REFERENCES audit_pages(id) ON DELETE CASCADE,
  
  issue_type issue_type NOT NULL,
  severity issue_severity NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  
  affected_element TEXT,
  current_value TEXT,
  expected_value TEXT,
  
  how_to_fix TEXT,
  learn_more_url TEXT,
  
  -- Impact on scores
  impacts_technical BOOLEAN DEFAULT false,
  impacts_content BOOLEAN DEFAULT false,
  impacts_aeo BOOLEAN DEFAULT false,
  impact_points INT DEFAULT 0,
  
  -- Status
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_issues_audit ON audit_issues(audit_id);
CREATE INDEX idx_audit_issues_severity ON audit_issues(severity);

-- ===========================================
-- CONTENT WORKFLOW
-- ===========================================

CREATE TYPE content_stage AS ENUM (
  'BRIEF', 'OUTLINE', 'DRAFT', 'REVIEW', 'FINAL', 'PUBLISHED', 'ARCHIVED'
);

-- Add stage to content
ALTER TABLE generated_content
ADD COLUMN IF NOT EXISTS stage content_stage DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS brief TEXT,
ADD COLUMN IF NOT EXISTS outline JSONB,
ADD COLUMN IF NOT EXISTS publish_target TEXT,
ADD COLUMN IF NOT EXISTS published_url TEXT,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- ===========================================
-- AGENT CONVERSATIONS
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  
  title TEXT,
  status TEXT DEFAULT 'active', -- active, archived
  
  -- Context
  context_snapshot JSONB, -- Captured workspace context at thread start
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL, -- user, assistant, system, tool
  content TEXT NOT NULL,
  
  -- Tool calls
  tool_calls JSONB, -- [{id, name, arguments}]
  tool_call_id TEXT, -- If this is a tool response
  
  -- Metadata
  model_used TEXT,
  tokens_used INT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_messages_thread ON agent_messages(thread_id);

-- Agent tool actions (audit trail)
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  
  tool_name TEXT NOT NULL,
  tool_input JSONB,
  tool_output JSONB,
  
  status TEXT DEFAULT 'pending', -- pending, approved, executed, rejected, failed
  
  -- Approval
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Execution
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_actions_thread ON agent_actions(thread_id);

-- ===========================================
-- REPORT DEFINITIONS
-- ===========================================

CREATE TYPE report_type AS ENUM (
  'VISIBILITY', 'COMPETITOR', 'AUDIT', 'CONTENT', 'DIGEST', 'EXECUTIVE', 'CUSTOM'
);

CREATE TYPE report_format AS ENUM ('JSON', 'CSV', 'PDF');
CREATE TYPE report_schedule AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  report_type report_type NOT NULL,
  format report_format DEFAULT 'JSON',
  
  -- Config
  config JSONB, -- Specific report options
  
  -- Filters
  date_range TEXT, -- last_7_days, last_30_days, custom
  custom_start_date DATE,
  custom_end_date DATE,
  platforms ai_platform[],
  
  -- Scheduling
  schedule report_schedule DEFAULT 'ONCE',
  schedule_day INT, -- Day of week (0-6) or day of month (1-31)
  schedule_time TIME DEFAULT '09:00',
  timezone TEXT DEFAULT 'UTC',
  
  -- Delivery
  email_recipients TEXT[],
  webhook_url TEXT,
  
  -- White label
  white_label BOOLEAN DEFAULT false,
  custom_branding JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  definition_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  
  -- Output
  data_payload JSONB,
  file_path TEXT,
  file_size_bytes INT,
  
  -- Delivery
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT,
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_report_runs_definition ON report_runs(definition_id);

-- ===========================================
-- ACTION TRACKING (Impact Measurement)
-- ===========================================

CREATE TABLE IF NOT EXISTS completed_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What was done
  action_type TEXT NOT NULL,
  action_description TEXT,
  
  -- Evidence
  before_snapshot JSONB, -- Scores/state before
  after_snapshot JSONB, -- Scores/state after (filled later)
  
  -- Timing
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  impact_measured_at TIMESTAMP WITH TIME ZONE,
  
  -- Impact
  score_change INT,
  impact_summary TEXT
);

CREATE INDEX idx_completed_actions_business ON completed_actions(business_id);

-- ===========================================
-- INTEGRATION SYNC JOBS
-- ===========================================

CREATE TABLE IF NOT EXISTS integration_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  job_type TEXT NOT NULL, -- full_sync, incremental, specific_metric
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  
  -- Config
  config JSONB,
  
  -- Progress
  total_items INT,
  processed_items INT,
  
  -- Results
  data_fetched JSONB,
  error_log TEXT[],
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_integration ON integration_sync_jobs(integration_id);

-- ===========================================
-- RLS POLICIES FOR NEW TABLES
-- ===========================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_engine_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Organization access (members only)
CREATE POLICY "Org members can view org" ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Org owners can update org" ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Workspace access
CREATE POLICY "Users can view own workspaces" ON workspaces FOR SELECT
  USING (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Agent threads (user's own)
CREATE POLICY "Users can manage own threads" ON agent_threads FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own messages" ON agent_messages FOR SELECT
  USING (thread_id IN (SELECT id FROM agent_threads WHERE user_id = auth.uid()));

-- Engine configs (read-only for all authenticated)
CREATE POLICY "Authenticated users can view engine configs" ON ai_engine_configs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Reports (user's own)
CREATE POLICY "Users can manage own reports" ON report_definitions FOR ALL
  USING (user_id = auth.uid());
