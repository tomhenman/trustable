/**
 * Plan Gating - Shared utility for limit enforcement
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PlanTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SCALE' | 'CUSTOM';

export interface PlanLimits {
  prompts: number;
  answers: number;
  articles: number;
  audits: number;
  competitors: number;
  businesses: number;
  platforms: string[];
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: {
    prompts: 10,
    answers: 100,
    articles: 2,
    audits: 5,
    competitors: 1,
    businesses: 1,
    platforms: ['chatgpt'],
  },
  STARTER: {
    prompts: 50,
    answers: 1500,
    articles: 5,
    audits: 50,
    competitors: 3,
    businesses: 1,
    platforms: ['chatgpt'],
  },
  PROFESSIONAL: {
    prompts: 100,
    answers: 9000,
    articles: 20,
    audits: 200,
    competitors: 10,
    businesses: -1,
    platforms: ['chatgpt', 'perplexity', 'google_ai', 'gemini'],
  },
  SCALE: {
    prompts: 500,
    answers: 45000,
    articles: 80,
    audits: 1000,
    competitors: 25,
    businesses: -1,
    platforms: ['chatgpt', 'claude', 'perplexity', 'google_ai', 'copilot', 'gemini'],
  },
  CUSTOM: {
    prompts: -1,
    answers: -1,
    articles: -1,
    audits: -1,
    competitors: -1,
    businesses: -1,
    platforms: ['chatgpt', 'claude', 'perplexity', 'google_ai', 'copilot', 'gemini', 'grok', 'deepseek'],
  },
};

export interface UserProfile {
  id: string;
  plan: PlanTier;
  prompts_used_this_month: number;
  answers_used_this_month: number;
  articles_used_this_month: number;
  audits_used_this_month: number;
  is_trial?: boolean;
  trial_ends_at?: string;
}

export interface LimitCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  error?: string;
}

/**
 * Check if user can perform action
 */
export function checkLimit(
  profile: UserProfile,
  resource: 'prompts' | 'answers' | 'articles' | 'audits',
  amount: number = 1
): LimitCheck {
  const limits = PLAN_LIMITS[profile.plan];
  const limit = limits[resource];
  
  const usageMap = {
    prompts: profile.prompts_used_this_month,
    answers: profile.answers_used_this_month,
    articles: profile.articles_used_this_month,
    audits: profile.audits_used_this_month,
  };
  
  const current = usageMap[resource] || 0;
  
  // Unlimited
  if (limit === -1) {
    return { allowed: true, current, limit: -1, remaining: -1 };
  }
  
  const remaining = limit - current;
  const allowed = remaining >= amount;
  
  return {
    allowed,
    current,
    limit,
    remaining: Math.max(0, remaining),
    error: allowed ? undefined : `${resource} limit reached (${current}/${limit}). Upgrade your plan.`,
  };
}

/**
 * Check if user can access specific platform
 */
export function canAccessPlatform(profile: UserProfile, platform: string): boolean {
  const limits = PLAN_LIMITS[profile.plan];
  return limits.platforms.includes(platform);
}

/**
 * Filter platforms to only allowed ones
 */
export function filterAllowedPlatforms(profile: UserProfile, requested: string[]): string[] {
  const limits = PLAN_LIMITS[profile.plan];
  return requested.filter(p => limits.platforms.includes(p));
}

/**
 * Check if feature is available
 */
export function hasFeature(plan: PlanTier, feature: string): boolean {
  const features: Record<string, PlanTier[]> = {
    'export_reports': ['PROFESSIONAL', 'SCALE', 'CUSTOM'],
    'white_label': ['SCALE', 'CUSTOM'],
    'api_access': ['CUSTOM'],
    'multi_region': ['PROFESSIONAL', 'SCALE', 'CUSTOM'],
    'scheduled_reports': ['PROFESSIONAL', 'SCALE', 'CUSTOM'],
    'agent_chat': ['PROFESSIONAL', 'SCALE', 'CUSTOM'],
    'priority_support': ['SCALE', 'CUSTOM'],
  };
  
  return features[feature]?.includes(plan) ?? false;
}

/**
 * Get user profile from database
 */
export async function getUserProfile(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string
): Promise<UserProfile | null> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, plan, prompts_used_this_month, answers_used_this_month, articles_used_this_month, audits_used_this_month, is_trial, trial_ends_at')
    .eq('id', userId)
    .single();
  
  if (error || !data) return null;
  return data as UserProfile;
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  resource: 'prompts' | 'answers' | 'articles' | 'audits',
  amount: number = 1
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  await supabase.rpc(`increment_${resource}_used`, {
    p_user_id: userId,
    p_amount: amount,
  });
}

/**
 * Create limit exceeded response
 */
export function limitExceededResponse(check: LimitCheck): Response {
  return new Response(
    JSON.stringify({
      error: check.error,
      usage: {
        current: check.current,
        limit: check.limit,
        remaining: check.remaining,
      },
      upgrade_url: '/pricing',
    }),
    { 
      status: 403, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      } 
    }
  );
}
