-- Migration 002: Add trial support and helper functions

-- ===========================================
-- TRIAL PERIOD SUPPORT
-- ===========================================

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- ===========================================
-- PRODUCT/SHOPPING QUERY TYPE
-- ===========================================

-- Add new query types if not exists (safe to run multiple times)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRODUCT_SEARCH' AND enumtypid = 'query_type'::regtype) THEN
    ALTER TYPE query_type ADD VALUE 'PRODUCT_SEARCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SERVICE_INQUIRY' AND enumtypid = 'query_type'::regtype) THEN
    ALTER TYPE query_type ADD VALUE 'SERVICE_INQUIRY';
  END IF;
END $$;

-- ===========================================
-- USAGE INCREMENT FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION increment_prompts_used(p_user_id UUID, p_amount INT DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET prompts_used_this_month = prompts_used_this_month + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_answers_used(p_user_id UUID, p_amount INT DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET answers_used_this_month = answers_used_this_month + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_articles_used(p_user_id UUID, p_amount INT DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET articles_used_this_month = articles_used_this_month + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_audits_used(p_user_id UUID, p_amount INT DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET audits_used_this_month = audits_used_this_month + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- ATOMIC CHECK AND INCREMENT
-- ===========================================

CREATE OR REPLACE FUNCTION check_and_use_quota(
  p_user_id UUID,
  p_resource TEXT,
  p_amount INT DEFAULT 1
)
RETURNS TABLE(allowed BOOLEAN, current_usage INT, limit_value INT, remaining INT) AS $$
DECLARE
  v_plan plan_tier;
  v_usage INT;
  v_limit INT;
BEGIN
  -- Lock row and get current values
  SELECT 
    plan,
    CASE p_resource
      WHEN 'prompts' THEN prompts_used_this_month
      WHEN 'answers' THEN answers_used_this_month
      WHEN 'articles' THEN articles_used_this_month
      WHEN 'audits' THEN audits_used_this_month
    END
  INTO v_plan, v_usage
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Determine limit based on plan
  v_limit := CASE 
    WHEN v_plan = 'CUSTOM' THEN -1
    WHEN p_resource = 'prompts' THEN
      CASE v_plan
        WHEN 'FREE' THEN 10
        WHEN 'STARTER' THEN 50
        WHEN 'PROFESSIONAL' THEN 100
        WHEN 'SCALE' THEN 500
      END
    WHEN p_resource = 'answers' THEN
      CASE v_plan
        WHEN 'FREE' THEN 100
        WHEN 'STARTER' THEN 1500
        WHEN 'PROFESSIONAL' THEN 9000
        WHEN 'SCALE' THEN 45000
      END
    WHEN p_resource = 'articles' THEN
      CASE v_plan
        WHEN 'FREE' THEN 2
        WHEN 'STARTER' THEN 5
        WHEN 'PROFESSIONAL' THEN 20
        WHEN 'SCALE' THEN 80
      END
    WHEN p_resource = 'audits' THEN
      CASE v_plan
        WHEN 'FREE' THEN 5
        WHEN 'STARTER' THEN 50
        WHEN 'PROFESSIONAL' THEN 200
        WHEN 'SCALE' THEN 1000
      END
  END;
  
  -- Check if allowed
  IF v_limit = -1 OR v_usage + p_amount <= v_limit THEN
    -- Increment usage
    EXECUTE format(
      'UPDATE user_profiles SET %I = %I + $1 WHERE id = $2',
      p_resource || '_used_this_month',
      p_resource || '_used_this_month'
    ) USING p_amount, p_user_id;
    
    RETURN QUERY SELECT 
      TRUE, 
      v_usage + p_amount, 
      v_limit, 
      CASE WHEN v_limit = -1 THEN -1 ELSE v_limit - (v_usage + p_amount) END;
  ELSE
    RETURN QUERY SELECT 
      FALSE, 
      v_usage, 
      v_limit, 
      CASE WHEN v_limit = -1 THEN -1 ELSE v_limit - v_usage END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GET PLAN LIMITS
-- ===========================================

CREATE OR REPLACE FUNCTION get_plan_limits(p_plan plan_tier)
RETURNS TABLE(prompts INT, answers INT, articles INT, audits INT, competitors INT, businesses INT) AS $$
BEGIN
  RETURN QUERY SELECT
    CASE p_plan
      WHEN 'FREE' THEN 10
      WHEN 'STARTER' THEN 50
      WHEN 'PROFESSIONAL' THEN 100
      WHEN 'SCALE' THEN 500
      WHEN 'CUSTOM' THEN -1
    END,
    CASE p_plan
      WHEN 'FREE' THEN 100
      WHEN 'STARTER' THEN 1500
      WHEN 'PROFESSIONAL' THEN 9000
      WHEN 'SCALE' THEN 45000
      WHEN 'CUSTOM' THEN -1
    END,
    CASE p_plan
      WHEN 'FREE' THEN 2
      WHEN 'STARTER' THEN 5
      WHEN 'PROFESSIONAL' THEN 20
      WHEN 'SCALE' THEN 80
      WHEN 'CUSTOM' THEN -1
    END,
    CASE p_plan
      WHEN 'FREE' THEN 5
      WHEN 'STARTER' THEN 50
      WHEN 'PROFESSIONAL' THEN 200
      WHEN 'SCALE' THEN 1000
      WHEN 'CUSTOM' THEN -1
    END,
    CASE p_plan
      WHEN 'FREE' THEN 1
      WHEN 'STARTER' THEN 3
      WHEN 'PROFESSIONAL' THEN 10
      WHEN 'SCALE' THEN 25
      WHEN 'CUSTOM' THEN -1
    END,
    CASE p_plan
      WHEN 'FREE' THEN 1
      WHEN 'STARTER' THEN 1
      WHEN 'PROFESSIONAL' THEN -1
      WHEN 'SCALE' THEN -1
      WHEN 'CUSTOM' THEN -1
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================
-- GET USER USAGE SUMMARY
-- ===========================================

CREATE OR REPLACE FUNCTION get_usage_summary(p_user_id UUID)
RETURNS TABLE(
  plan plan_tier,
  prompts_used INT,
  prompts_limit INT,
  answers_used INT,
  answers_limit INT,
  articles_used INT,
  articles_limit INT,
  audits_used INT,
  audits_limit INT,
  usage_reset_at TIMESTAMP WITH TIME ZONE,
  is_trial BOOLEAN,
  trial_ends_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.plan,
    up.prompts_used_this_month,
    (SELECT prompts FROM get_plan_limits(up.plan)),
    up.answers_used_this_month,
    (SELECT answers FROM get_plan_limits(up.plan)),
    up.articles_used_this_month,
    (SELECT articles FROM get_plan_limits(up.plan)),
    up.audits_used_this_month,
    (SELECT audits FROM get_plan_limits(up.plan)),
    up.usage_reset_at,
    up.is_trial,
    up.trial_ends_at
  FROM user_profiles up
  WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- START TRIAL
-- ===========================================

CREATE OR REPLACE FUNCTION start_trial(p_user_id UUID, p_days INT DEFAULT 14)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET 
    plan = 'PROFESSIONAL',
    is_trial = true,
    trial_ends_at = NOW() + (p_days || ' days')::INTERVAL
  WHERE id = p_user_id
    AND plan = 'FREE'
    AND is_trial = false
    AND trial_ends_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- EXPIRE TRIALS (run daily via cron)
-- ===========================================

CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INT AS $$
DECLARE
  expired_count INT;
BEGIN
  UPDATE user_profiles
  SET 
    plan = 'FREE',
    is_trial = false
  WHERE is_trial = true
    AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- CRON JOBS (requires pg_cron extension)
-- ===========================================

-- These will error if pg_cron isn't available, which is fine
-- Run these manually after enabling pg_cron:

-- SELECT cron.schedule('expire-trials', '0 0 * * *', 'SELECT expire_trials()');
-- SELECT cron.schedule('reset-usage', '0 0 1 * *', 'SELECT reset_monthly_usage()');
