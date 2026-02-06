/**
 * Trustable - Data Models
 * 
 * TypeScript interfaces matching the Postgres schema.
 * For Lovable integration, these can be generated via `supabase gen types`.
 */

// ===========================================
// ENUMS
// ===========================================

export type PlanTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SCALE' | 'CUSTOM';

export type QueryType = 
  | 'BRAND_DIRECT' | 'CATEGORY_SEARCH' | 'RECOMMENDATION' | 'COMPARISON'
  | 'REVIEW_INQUIRY' | 'LOCAL_SEARCH' | 'PRODUCT_SEARCH' | 'SERVICE_INQUIRY'
  | 'PRICING_INQUIRY' | 'ALTERNATIVE_SEARCH' | 'INDUSTRY_LEADER' | 'TRUST_VERIFICATION';

export type AIPlatform = 
  | 'chatgpt' | 'claude' | 'perplexity' | 'google_ai' 
  | 'copilot' | 'gemini' | 'grok' | 'deepseek';

export type MentionType = 
  | 'PRIMARY' | 'FEATURED' | 'LISTED' | 'BRIEF' 
  | 'COMPARISON' | 'CITATION' | 'NEGATIVE' | 'ABSENT';

export type SentimentType = 
  | 'VERY_POSITIVE' | 'POSITIVE' | 'NEUTRAL' 
  | 'CAUTIOUS' | 'NEGATIVE' | 'VERY_NEGATIVE';

export type ScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ScanType = 'FULL' | 'QUICK' | 'COMPETITOR' | 'LOCAL' | 'SCHEDULED';

export type ContentType = 
  | 'ABOUT_PAGE' | 'SERVICE_PAGE' | 'PRODUCT_PAGE' | 'FAQ_PAGE' 
  | 'BLOG_POST' | 'LANDING_PAGE' | 'META_DESCRIPTION' | 'SOCIAL_POST' 
  | 'TIKTOK_SCRIPT' | 'EMAIL' | 'REVIEW_REQUEST' | 'CASE_STUDY' | 'PRESS_RELEASE'
  | 'LOCAL_SERVICE_PAGE';

export type ContentStage = 'BRIEF' | 'OUTLINE' | 'DRAFT' | 'REVIEW' | 'FINAL' | 'PUBLISHED' | 'ARCHIVED';

export type AlertType = 
  | 'SCORE_DROP' | 'SCORE_IMPROVEMENT' | 'VISIBILITY_LOST' | 'VISIBILITY_GAINED'
  | 'NEW_NEGATIVE_MENTION' | 'NEW_POSITIVE_MENTION' | 'COMPETITOR_OVERTAKE'
  | 'CITATION_ADDED' | 'CITATION_LOST' | 'RANKING_CHANGE' | 'SHARE_OF_VOICE_CHANGE'
  | 'RECOMMENDATION_URGENT' | 'AUDIT_CRITICAL' | 'ZERO_MENTIONS_SPIKE';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'POSITIVE';

export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type IssueType = 
  | 'MISSING_TITLE' | 'TITLE_TOO_SHORT' | 'TITLE_TOO_LONG'
  | 'MISSING_META_DESC' | 'META_DESC_TOO_SHORT' | 'META_DESC_TOO_LONG'
  | 'MISSING_H1' | 'MULTIPLE_H1' | 'MISSING_H2'
  | 'THIN_CONTENT' | 'DUPLICATE_CONTENT'
  | 'MISSING_SCHEMA' | 'INVALID_SCHEMA' | 'MISSING_LOCAL_SCHEMA' | 'MISSING_ORG_SCHEMA' | 'MISSING_FAQ_SCHEMA'
  | 'MISSING_CANONICAL' | 'BROKEN_CANONICAL'
  | 'MISSING_VIEWPORT' | 'SLOW_LOAD' | 'LARGE_PAGE'
  | 'BROKEN_LINKS' | 'MISSING_ALT_TEXT'
  | 'NO_ROBOTS' | 'BLOCKED_BY_ROBOTS'
  | 'NO_SITEMAP' | 'SITEMAP_ERRORS'
  | 'NAP_INCONSISTENCY' | 'MISSING_NAP';

export type ReportType = 
  | 'VISIBILITY_SUMMARY' | 'PROMPT_PERFORMANCE' | 'COMPETITIVE_ANALYSIS'
  | 'EXECUTIVE_BRIEFING' | 'TRUST_RECOMMENDATION_AUDIT' | 'LOCAL_READINESS'
  | 'DIGEST' | 'CUSTOM';

export type ReportFormat = 'JSON' | 'CSV' | 'PDF';
export type ReportSchedule = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

// ===========================================
// CORE ENTITIES
// ===========================================

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  company_name?: string;
  plan: PlanTier;
  stripe_customer_id?: string;
  
  // Usage tracking
  prompts_used_this_month: number;
  answers_used_this_month: number;
  articles_used_this_month: number;
  audits_used_this_month: number;
  usage_reset_at: string;
  
  // Trial
  is_trial: boolean;
  trial_ends_at?: string;
  
  // Preferences
  digest_enabled: boolean;
  digest_frequency: string;
  alert_email: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  plan: PlanTier;
  
  white_label_enabled: boolean;
  white_label_name?: string;
  white_label_logo_url?: string;
  api_access_enabled: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  
  // Basic
  name: string;
  description?: string;
  website?: string;
  category?: string;
  subcategory?: string;
  industry?: string;
  founded_year?: number;
  
  // Location (for NAP consistency)
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  service_area?: string[];
  
  // Contact (for NAP)
  phone?: string;
  email?: string;
  
  // Social
  google_place_id?: string;
  google_business_url?: string;
  facebook_url?: string;
  instagram_handle?: string;
  tiktok_handle?: string;
  twitter_handle?: string;
  linkedin_url?: string;
  youtube_channel?: string;
  
  // Tracking
  keywords?: string[];
  products?: string[];
  services?: string[];
  competitors?: string[];
  brand_variations?: string[];
  
  // Settings
  monitoring_frequency: string;
  monitoring_enabled: boolean;
  
  // Brand voice (for agent)
  brand_voice?: string;
  tone_guidelines?: string;
  
  created_at: string;
  updated_at: string;
}

// ===========================================
// PROMPTS & RESULTS
// ===========================================

export interface TrackedPrompt {
  id: string;
  business_id: string;
  group_id?: string;
  
  prompt: string;
  query_type: QueryType;
  priority: string;
  
  target_region?: string;
  target_language: string;
  
  frequency: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  
  created_at: string;
}

export interface PromptResult {
  id: string;
  prompt_id?: string;
  business_id: string;
  scan_id?: string;
  
  platform: AIPlatform;
  query: string;
  response: string;
  
  // Analysis
  mentioned: boolean;
  mention_type?: MentionType;
  mention_context?: string;
  mention_count: number;
  
  sentiment?: SentimentType;
  sentiment_score?: number;
  confidence_score?: number;
  
  has_hedging: boolean;
  hedging_phrases?: string[];
  
  is_recommended: boolean;
  recommendation_strength?: string;
  
  ranking?: number;
  cited_url?: string;
  cited_sources?: string[];
  competitors_mentioned?: string[];
  
  key_phrases?: string[];
  positive_indicators?: string[];
  negative_indicators?: string[];
  
  // Meta
  response_time_ms?: number;
  token_count?: number;
  model_used?: string;
  
  created_at: string;
}

// ===========================================
// SCANS & SCORES
// ===========================================

export interface Scan {
  id: string;
  business_id: string;
  
  scan_type: ScanType;
  status: ScanStatus;
  
  platforms: AIPlatform[];
  prompts_count: number;
  results_count: number;
  
  scores?: Scores;
  highlights?: string[];
  critical_issues?: string[];
  
  error_message?: string;
  
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Scores {
  id: string;
  business_id: string;
  scan_id?: string;
  
  // Trustable scores
  overall_score: number;
  ai_trust_score: number;
  ai_visibility_score: number;
  ai_recommendation_score: number;
  ai_citation_score: number;
  sentiment_score: number;
  confidence_score: number;
  local_visibility_score: number;
  social_discovery_score: number;
  review_strength_score: number;
  
  // Searchable-style scores
  technical_score?: number;
  content_score?: number;
  aeo_score?: number;
  health_score?: number;
  
  // Other
  website_optimization_score: number;
  technical_readiness_score: number;
  category_authority_score: number;
  share_of_voice?: number;
  
  // Change tracking
  previous_score_id?: string;
  overall_change?: number;
  
  created_at: string;
}

// ===========================================
// AUDITS
// ===========================================

export interface SiteAudit {
  id: string;
  business_id: string;
  website_url: string;
  
  status: ScanStatus;
  
  // Scores
  overall_score?: number;
  technical_score?: number;
  content_score?: number;
  schema_score?: number;
  crawlability_score?: number;
  
  // Issues
  critical_issues?: AuditIssue[];
  warnings?: AuditIssue[];
  passed_checks?: { name: string; description: string }[];
  
  // Pages
  pages_analyzed: number;
  sitemap_url?: string;
  discovered_pages?: string[];
  
  // Schema
  schema_types?: string[];
  missing_schema?: string[];
  
  // NAP
  nap_consistent?: boolean;
  nap_issues?: string[];
  
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface AuditPage {
  id: string;
  audit_id: string;
  
  url: string;
  path?: string;
  
  status_code?: number;
  response_time_ms?: number;
  content_size_bytes?: number;
  
  title?: string;
  meta_description?: string;
  h1_text?: string;
  h1_count: number;
  h2_count: number;
  word_count: number;
  
  has_canonical: boolean;
  canonical_url?: string;
  has_viewport: boolean;
  
  schema_types?: string[];
  schema_valid: boolean;
  
  internal_links: number;
  external_links: number;
  broken_links: number;
  
  images_count: number;
  images_without_alt: number;
  
  // Per-page scores
  technical_score?: number;
  content_score?: number;
  aeo_score?: number;
  
  issues?: AuditIssue[];
  actions?: string[];
  
  crawled_at: string;
}

export interface AuditIssue {
  id?: string;
  audit_id?: string;
  page_id?: string;
  
  issue_type: IssueType;
  severity: IssueSeverity;
  
  title: string;
  description: string;
  
  affected_element?: string;
  current_value?: string;
  expected_value?: string;
  
  how_to_fix: string;
  learn_more_url?: string;
  
  impacts_technical: boolean;
  impacts_content: boolean;
  impacts_aeo: boolean;
  impact_points: number;
  
  is_resolved: boolean;
  resolved_at?: string;
}

// ===========================================
// CONTENT
// ===========================================

export interface ContentRequest {
  business_id: string;
  content_type: ContentType;
  
  // Context
  topic?: string;
  service_name?: string;
  product_name?: string;
  target_audience?: string;
  
  // Options
  word_count_target?: number;
  tone?: string;
  
  // Compliance
  include_disclaimers: boolean;
  disclaimers?: string[];
  prohibited_claims?: string[];
  
  // Publishing
  publish_target?: string; // wordpress, webflow, etc.
}

export interface GeneratedContent {
  id: string;
  business_id: string;
  
  content_type: ContentType;
  stage: ContentStage;
  
  title: string;
  
  // Workflow stages
  brief?: string;
  outline?: ContentOutline;
  content: string;
  
  // Meta
  word_count: number;
  reading_time_minutes: number;
  
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
  
  // Suggestions
  internal_link_suggestions?: LinkSuggestion[];
  schema_blocks?: SchemaBlock[];
  callouts?: string[];
  citation_strategy?: string;
  
  // Compliance
  disclaimers?: string[];
  
  // Scoring
  ai_optimization_score: number;
  ai_optimization_notes?: string[];
  
  // Publishing
  status: string;
  publish_target?: string;
  published_url?: string;
  published_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface ContentOutline {
  sections: {
    heading: string;
    level: number;
    key_points: string[];
    word_count_target?: number;
  }[];
  total_sections: number;
  estimated_word_count: number;
}

export interface LinkSuggestion {
  anchor_text: string;
  target_page: string;
  reason: string;
}

export interface SchemaBlock {
  type: string; // Organization, FAQ, HowTo, etc.
  json_ld: object;
}

// ===========================================
// RECOMMENDATIONS
// ===========================================

export interface Recommendation {
  id: string;
  business_id: string;
  
  category: string;
  priority: string;
  
  title: string;
  description: string;
  reasoning?: string;
  
  action_steps?: ActionStep[];
  
  generated_content?: string;
  template?: string;
  
  impact_areas?: string[];
  estimated_impact: number;
  estimated_effort: string;
  estimated_time_minutes: number;
  
  status: string;
  completed_at?: string;
  snoozed_until?: string;
  
  created_at: string;
  expires_at?: string;
}

export interface ActionStep {
  order: number;
  title: string;
  description: string;
  is_completed: boolean;
}

// ===========================================
// ALERTS
// ===========================================

export interface Alert {
  id: string;
  user_id: string;
  business_id?: string;
  
  alert_type: AlertType;
  severity: AlertSeverity;
  
  title: string;
  message: string;
  data?: object;
  
  action_url?: string;
  action_label?: string;
  
  recommended_actions?: string[];
  
  read: boolean;
  read_at?: string;
  
  created_at: string;
  expires_at?: string;
}

export interface AlertRule {
  id: string;
  business_id?: string;
  user_id: string;
  
  alert_type: AlertType;
  is_enabled: boolean;
  
  // Thresholds
  threshold_value?: number;
  comparison?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  
  // Delivery
  notify_email: boolean;
  notify_push: boolean;
  notify_webhook: boolean;
  webhook_url?: string;
  
  created_at: string;
}

// ===========================================
// REPORTS
// ===========================================

export interface ReportDefinition {
  id: string;
  user_id: string;
  business_id?: string;
  
  name: string;
  report_type: ReportType;
  format: ReportFormat;
  
  config?: object;
  
  // Filters
  date_range?: string;
  custom_start_date?: string;
  custom_end_date?: string;
  platforms?: AIPlatform[];
  
  // Schedule
  schedule: ReportSchedule;
  schedule_day?: number;
  schedule_time?: string;
  timezone?: string;
  
  // Delivery
  email_recipients?: string[];
  webhook_url?: string;
  
  // White label
  white_label: boolean;
  custom_branding?: {
    company_name?: string;
    logo_url?: string;
    primary_color?: string;
  };
  
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  
  created_at: string;
}

export interface ReportPayload {
  report_id: string;
  report_type: ReportType;
  format: ReportFormat;
  generated_at: string;
  
  // Branding
  branding?: {
    company_name: string;
    logo_url?: string;
    primary_color?: string;
  };
  
  // Business context
  business: {
    name: string;
    website?: string;
    category?: string;
    location?: string;
  };
  
  // Date range
  period: {
    start: string;
    end: string;
    label: string;
  };
  
  // Content (varies by report type)
  sections: ReportSection[];
  
  // Summary
  executive_summary?: string;
  key_findings?: string[];
  recommended_actions?: string[];
}

export interface ReportSection {
  title: string;
  type: 'scores' | 'chart' | 'table' | 'list' | 'text';
  data: any;
}

// ===========================================
// AGENT
// ===========================================

export interface AgentThread {
  id: string;
  workspace_id?: string;
  user_id: string;
  business_id?: string;
  
  title?: string;
  status: string;
  
  context_snapshot?: AgentContext;
  
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  thread_id: string;
  
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  
  model_used?: string;
  tokens_used?: number;
  
  created_at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: object;
}

export interface AgentContext {
  business: Business;
  latest_scores?: Scores;
  latest_audit?: SiteAudit;
  pending_recommendations?: Recommendation[];
  recent_alerts?: Alert[];
  current_prompt_set?: TrackedPrompt[];
  brand_voice?: string;
  files_metadata?: { name: string; type: string; summary?: string }[];
}

export interface AgentAction {
  id: string;
  thread_id: string;
  message_id?: string;
  
  tool_name: string;
  tool_input: object;
  tool_output?: object;
  
  status: 'pending' | 'approved' | 'executed' | 'rejected' | 'failed';
  
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  
  executed_at?: string;
  error_message?: string;
  
  created_at: string;
}
