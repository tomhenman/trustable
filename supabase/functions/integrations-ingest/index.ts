/**
 * Integrations Ingest Edge Function
 * 
 * Accepts data from frontend (which handles OAuth) and stores it.
 * Supports: GA4, GSC, Reviews
 * 
 * Frontend is responsible for:
 * - OAuth flow
 * - Token refresh
 * - Calling external APIs
 * - Sending normalized data here
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// INTERFACES
// ===========================================

interface GA4Metrics {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  pagesPerSession: number;
  organicSessions?: number;
  directSessions?: number;
  referralSessions?: number;
  socialSessions?: number;
  conversions?: number;
  conversionValue?: number;
}

interface GA4PageMetrics {
  date: string;
  pagePath: string;
  pageTitle?: string;
  pageViews: number;
  uniquePageViews: number;
  avgTimeOnPage: number;
  entrances: number;
  exits: number;
  bounceRate: number;
}

interface GSCMetrics {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

interface GSCPageMetrics {
  date: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

interface GSCQueryMetrics {
  date: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

interface NormalizedReview {
  platform: string;
  platformReviewId: string;
  authorName?: string;
  authorAvatarUrl?: string;
  rating: number;
  title?: string;
  content: string;
  reviewDate: string;
  verifiedPurchase?: boolean;
  hasResponse?: boolean;
  responseText?: string;
  responseDate?: string;
}

// ===========================================
// SENTIMENT SCORING
// ===========================================

function scoreReviewSentiment(text: string, rating: number): { sentiment: string; score: number } {
  const positive = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'recommend'];
  const negative = ['terrible', 'awful', 'horrible', 'worst', 'hate', 'disappointed', 'avoid', 'scam'];
  
  const lowerText = text.toLowerCase();
  const posCount = positive.filter(w => lowerText.includes(w)).length;
  const negCount = negative.filter(w => lowerText.includes(w)).length;
  
  // Combine text analysis with rating
  let score = (rating - 3) / 2; // -1 to 1 from rating
  score += (posCount - negCount) * 0.1;
  score = Math.max(-1, Math.min(1, score));
  
  let sentiment: string;
  if (score > 0.3) sentiment = 'POSITIVE';
  else if (score > 0) sentiment = 'POSITIVE';
  else if (score < -0.3) sentiment = 'NEGATIVE';
  else if (score < 0) sentiment = 'CAUTIOUS';
  else sentiment = 'NEUTRAL';
  
  return { sentiment, score };
}

function extractThemes(text: string): string[] {
  const themes: string[] = [];
  const lowerText = text.toLowerCase();
  
  const themePatterns = [
    { pattern: /customer service|support|help/i, theme: 'customer_service' },
    { pattern: /price|cost|expensive|cheap|value/i, theme: 'pricing' },
    { pattern: /quality|well.?made|durable/i, theme: 'quality' },
    { pattern: /fast|quick|slow|delivery|shipping/i, theme: 'speed' },
    { pattern: /easy|simple|difficult|confusing/i, theme: 'usability' },
    { pattern: /professional|knowledgeable|expert/i, theme: 'expertise' },
  ];
  
  for (const { pattern, theme } of themePatterns) {
    if (pattern.test(lowerText)) {
      themes.push(theme);
    }
  }
  
  return themes;
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, businessId, data } = await req.json();

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // INGEST GA4 METRICS
    // ===========================================
    if (action === 'ingest_ga4') {
      const metrics: GA4Metrics[] = data.metrics || [];
      const pageMetrics: GA4PageMetrics[] = data.pageMetrics || [];

      // Upsert aggregate metrics
      for (const m of metrics) {
        await supabase.from('ga4_metrics').upsert({
          business_id: businessId,
          date: m.date,
          sessions: m.sessions,
          users: m.users,
          new_users: m.newUsers,
          page_views: m.pageViews,
          avg_session_duration: m.avgSessionDuration,
          bounce_rate: m.bounceRate,
          pages_per_session: m.pagesPerSession,
          organic_sessions: m.organicSessions,
          direct_sessions: m.directSessions,
          referral_sessions: m.referralSessions,
          social_sessions: m.socialSessions,
          conversions: m.conversions,
          conversion_value: m.conversionValue,
        }, { onConflict: 'business_id,date' });
      }

      // Upsert page metrics
      for (const pm of pageMetrics) {
        await supabase.from('ga4_page_metrics').upsert({
          business_id: businessId,
          date: pm.date,
          page_path: pm.pagePath,
          page_title: pm.pageTitle,
          page_views: pm.pageViews,
          unique_page_views: pm.uniquePageViews,
          avg_time_on_page: pm.avgTimeOnPage,
          entrances: pm.entrances,
          exits: pm.exits,
          bounce_rate: pm.bounceRate,
        }, { onConflict: 'business_id,date,page_path' });
      }

      // Update connection last sync
      await supabase
        .from('ga4_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('business_id', businessId);

      return new Response(
        JSON.stringify({
          success: true,
          metricsIngested: metrics.length,
          pageMetricsIngested: pageMetrics.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // INGEST GSC METRICS
    // ===========================================
    if (action === 'ingest_gsc') {
      const metrics: GSCMetrics[] = data.metrics || [];
      const pageMetrics: GSCPageMetrics[] = data.pageMetrics || [];
      const queryMetrics: GSCQueryMetrics[] = data.queryMetrics || [];

      // Upsert aggregate metrics
      for (const m of metrics) {
        await supabase.from('gsc_metrics').upsert({
          business_id: businessId,
          date: m.date,
          clicks: m.clicks,
          impressions: m.impressions,
          ctr: m.ctr,
          avg_position: m.avgPosition,
        }, { onConflict: 'business_id,date' });
      }

      // Upsert page metrics
      for (const pm of pageMetrics) {
        await supabase.from('gsc_page_metrics').upsert({
          business_id: businessId,
          date: pm.date,
          page_url: pm.pageUrl,
          clicks: pm.clicks,
          impressions: pm.impressions,
          ctr: pm.ctr,
          avg_position: pm.avgPosition,
        }, { onConflict: 'business_id,date,page_url' });
      }

      // Upsert query metrics
      for (const qm of queryMetrics) {
        await supabase.from('gsc_query_metrics').upsert({
          business_id: businessId,
          date: qm.date,
          query: qm.query,
          clicks: qm.clicks,
          impressions: qm.impressions,
          ctr: qm.ctr,
          avg_position: qm.avgPosition,
        }, { onConflict: 'business_id,date,query' });
      }

      // Update connection
      await supabase
        .from('gsc_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('business_id', businessId);

      return new Response(
        JSON.stringify({
          success: true,
          metricsIngested: metrics.length,
          pageMetricsIngested: pageMetrics.length,
          queryMetricsIngested: queryMetrics.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // INGEST REVIEWS
    // ===========================================
    if (action === 'ingest_reviews') {
      const reviews: NormalizedReview[] = data.reviews || [];
      const platform = data.platform;
      const connectionId = data.connectionId;

      let inserted = 0;
      let updated = 0;

      for (const review of reviews) {
        // Score sentiment
        const { sentiment, score } = scoreReviewSentiment(review.content, review.rating);
        const themes = extractThemes(review.content);

        // Upsert review
        const { data: existing } = await supabase
          .from('reviews')
          .select('id')
          .eq('platform', platform)
          .eq('platform_review_id', review.platformReviewId)
          .single();

        if (existing) {
          await supabase.from('reviews').update({
            rating: review.rating,
            content: review.content,
            sentiment,
            sentiment_score: score,
            themes,
            has_response: review.hasResponse,
            response_text: review.responseText,
            response_date: review.responseDate,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('reviews').insert({
            business_id: businessId,
            connection_id: connectionId,
            platform,
            platform_review_id: review.platformReviewId,
            author_name: review.authorName,
            author_avatar_url: review.authorAvatarUrl,
            rating: review.rating,
            title: review.title,
            content: review.content,
            sentiment,
            sentiment_score: score,
            themes,
            review_date: review.reviewDate,
            verified_purchase: review.verifiedPurchase,
            has_response: review.hasResponse,
            response_text: review.responseText,
            response_date: review.responseDate,
          });
          inserted++;
        }
      }

      // Update aggregates
      await updateReviewAggregates(supabase, businessId);

      // Check for negative spike
      await checkNegativeSpike(supabase, businessId);

      return new Response(
        JSON.stringify({
          success: true,
          inserted,
          updated,
          total: reviews.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // CORRELATION: AI vs Organic Traffic
    // ===========================================
    if (action === 'get_correlation') {
      // Get AI visibility scores over time
      const { data: scores } = await supabase
        .from('scores')
        .select('created_at, ai_visibility_score, overall_score')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true })
        .limit(30);

      // Get GA4 organic traffic over time
      const { data: traffic } = await supabase
        .from('ga4_metrics')
        .select('date, organic_sessions, sessions')
        .eq('business_id', businessId)
        .order('date', { ascending: true })
        .limit(30);

      // Calculate simple correlation
      let correlation = 0;
      if (scores && traffic && scores.length > 5 && traffic.length > 5) {
        // Simplified correlation calculation
        const visibilityTrend = scores[scores.length - 1].ai_visibility_score - scores[0].ai_visibility_score;
        const trafficTrend = (traffic[traffic.length - 1].organic_sessions || 0) - (traffic[0].organic_sessions || 0);
        
        if (visibilityTrend > 0 && trafficTrend > 0) correlation = 0.7;
        else if (visibilityTrend < 0 && trafficTrend < 0) correlation = 0.7;
        else if (visibilityTrend > 0 && trafficTrend < 0) correlation = -0.3;
        else correlation = 0;
      }

      return new Response(
        JSON.stringify({
          success: true,
          correlation,
          visibilityData: scores,
          trafficData: traffic,
          insight: correlation > 0.5 
            ? 'AI visibility improvements correlate positively with organic traffic' 
            : correlation < -0.3
            ? 'AI visibility and organic traffic are diverging - investigate'
            : 'Not enough data to determine correlation',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // PAGES LOSING TRAFFIC
    // ===========================================
    if (action === 'get_declining_pages') {
      // Compare last 7 days vs previous 7 days
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

      const { data: recentPages } = await supabase
        .from('gsc_page_metrics')
        .select('page_url, clicks, impressions')
        .eq('business_id', businessId)
        .gte('date', weekAgo.toISOString().split('T')[0]);

      const { data: previousPages } = await supabase
        .from('gsc_page_metrics')
        .select('page_url, clicks, impressions')
        .eq('business_id', businessId)
        .gte('date', twoWeeksAgo.toISOString().split('T')[0])
        .lt('date', weekAgo.toISOString().split('T')[0]);

      // Aggregate by page
      const recentByPage: Record<string, { clicks: number; impressions: number }> = {};
      const previousByPage: Record<string, { clicks: number; impressions: number }> = {};

      (recentPages || []).forEach((p: any) => {
        if (!recentByPage[p.page_url]) recentByPage[p.page_url] = { clicks: 0, impressions: 0 };
        recentByPage[p.page_url].clicks += p.clicks;
        recentByPage[p.page_url].impressions += p.impressions;
      });

      (previousPages || []).forEach((p: any) => {
        if (!previousByPage[p.page_url]) previousByPage[p.page_url] = { clicks: 0, impressions: 0 };
        previousByPage[p.page_url].clicks += p.clicks;
        previousByPage[p.page_url].impressions += p.impressions;
      });

      // Find declining pages
      const declining = Object.entries(recentByPage)
        .map(([url, recent]) => {
          const previous = previousByPage[url] || { clicks: 0, impressions: 0 };
          const clickChange = recent.clicks - previous.clicks;
          const percentChange = previous.clicks > 0 
            ? ((clickChange / previous.clicks) * 100) 
            : 0;
          return { url, ...recent, previous, clickChange, percentChange };
        })
        .filter(p => p.clickChange < -5 || p.percentChange < -20)
        .sort((a, b) => a.clickChange - b.clickChange)
        .slice(0, 10);

      return new Response(
        JSON.stringify({
          success: true,
          decliningPages: declining,
          message: declining.length > 0 
            ? `${declining.length} pages losing traffic` 
            : 'No significant traffic decline detected',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Integrations Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function updateReviewAggregates(supabase: any, businessId: string) {
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, sentiment, platform')
    .eq('business_id', businessId);

  if (!reviews || reviews.length === 0) return;

  const agg = {
    total_reviews: reviews.length,
    average_rating: reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length,
    five_star: reviews.filter((r: any) => r.rating === 5).length,
    four_star: reviews.filter((r: any) => r.rating === 4).length,
    three_star: reviews.filter((r: any) => r.rating === 3).length,
    two_star: reviews.filter((r: any) => r.rating === 2).length,
    one_star: reviews.filter((r: any) => r.rating === 1).length,
    positive_count: reviews.filter((r: any) => r.sentiment === 'POSITIVE' || r.sentiment === 'VERY_POSITIVE').length,
    neutral_count: reviews.filter((r: any) => r.sentiment === 'NEUTRAL').length,
    negative_count: reviews.filter((r: any) => r.sentiment === 'NEGATIVE' || r.sentiment === 'VERY_NEGATIVE' || r.sentiment === 'CAUTIOUS').length,
  };

  await supabase.from('review_aggregates').upsert({
    business_id: businessId,
    period: 'all',
    ...agg,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'business_id,period' });
}

async function checkNegativeSpike(supabase: any, businessId: string) {
  // Get reviews from last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const { data: recentReviews } = await supabase
    .from('reviews')
    .select('rating, sentiment')
    .eq('business_id', businessId)
    .gte('created_at', weekAgo.toISOString());

  if (!recentReviews || recentReviews.length < 3) return;

  const negativeCount = recentReviews.filter((r: any) => 
    r.rating <= 2 || r.sentiment === 'NEGATIVE' || r.sentiment === 'VERY_NEGATIVE'
  ).length;

  const negativeRate = negativeCount / recentReviews.length;

  if (negativeRate > 0.3) {
    // Create alert
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id, name')
      .eq('id', businessId)
      .single();

    if (business) {
      await supabase.from('alerts').insert({
        user_id: business.user_id,
        business_id: businessId,
        alert_type: 'NEW_NEGATIVE_MENTION',
        severity: 'CRITICAL',
        title: 'Negative Review Spike Detected',
        message: `${negativeCount} negative reviews in the last 7 days (${Math.round(negativeRate * 100)}% negative rate)`,
        recommended_actions: [
          'Review recent negative feedback for common themes',
          'Respond promptly to address concerns',
          'Investigate potential service issues',
        ],
      });
    }
  }
}
