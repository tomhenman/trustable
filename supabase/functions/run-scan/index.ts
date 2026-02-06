/**
 * Run Scan Edge Function
 * 
 * Orchestrates a complete AI visibility scan:
 * 1. Generates prompts for the business
 * 2. Queries all configured AI platforms
 * 3. Analyzes responses
 * 4. Calculates scores
 * 5. Generates recommendations
 * 6. Stores results
 * 7. Creates alerts if needed
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// ANALYSIS FUNCTIONS
// ===========================================

const HEDGING_WORDS = [
  'might', 'could', 'may', 'possibly', 'perhaps', 'maybe',
  'generally', 'typically', 'usually', 'sometimes', 'often',
  'it seems', 'appears to', 'tends to', 'some say',
];

const POSITIVE_INDICATORS = [
  'excellent', 'outstanding', 'great', 'recommend', 'trusted',
  'reliable', 'best', 'top', 'quality', 'professional',
  'highly recommended', 'well-known', 'established',
];

const NEGATIVE_INDICATORS = [
  'complaints', 'issues', 'problems', 'avoid', 'poor',
  'negative', 'scam', 'controversial', 'warning', 'careful',
];

const RECOMMENDATION_PHRASES = [
  'recommend', 'suggest', 'consider', 'good choice', 'worth',
  'definitely', 'should try', 'top pick',
];

function analyzeResponse(responseText: string, businessName: string, competitors: string[] = []) {
  const lowerText = responseText.toLowerCase();
  const lowerBusiness = businessName.toLowerCase();
  
  // Check if mentioned
  const mentioned = lowerText.includes(lowerBusiness);
  
  // Count mentions
  const mentionRegex = new RegExp(lowerBusiness.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const mentionCount = (responseText.match(mentionRegex) || []).length;
  
  // Extract mention context
  let mentionContext = '';
  if (mentioned) {
    const index = lowerText.indexOf(lowerBusiness);
    const start = Math.max(0, index - 150);
    const end = Math.min(responseText.length, index + businessName.length + 150);
    mentionContext = responseText.substring(start, end);
    if (start > 0) mentionContext = '...' + mentionContext;
    if (end < responseText.length) mentionContext = mentionContext + '...';
  }
  
  // Analyze sentiment
  const positiveCount = POSITIVE_INDICATORS.filter(p => lowerText.includes(p)).length;
  const negativeCount = NEGATIVE_INDICATORS.filter(n => lowerText.includes(n)).length;
  const sentimentScore = (positiveCount - negativeCount) / Math.max(1, positiveCount + negativeCount);
  
  let sentiment: string;
  if (negativeCount >= 2) sentiment = 'NEGATIVE';
  else if (sentimentScore > 0.3) sentiment = 'POSITIVE';
  else if (sentimentScore > 0) sentiment = 'POSITIVE';
  else if (negativeCount > 0) sentiment = 'CAUTIOUS';
  else sentiment = 'NEUTRAL';
  
  // Check hedging
  const hedgingPhrases = HEDGING_WORDS.filter(h => lowerText.includes(h));
  const hasHedging = hedgingPhrases.length >= 2;
  
  // Check recommendation
  const recommendationCount = RECOMMENDATION_PHRASES.filter(r => lowerText.includes(r)).length;
  const isRecommended = recommendationCount > 0 && sentiment !== 'NEGATIVE';
  const recommendationStrength = recommendationCount >= 2 ? 'STRONG' : recommendationCount === 1 ? 'MODERATE' : 'NONE';
  
  // Confidence score
  const confidenceScore = Math.max(0, Math.min(1, 0.5 + (positiveCount * 0.1) - (hedgingPhrases.length * 0.1)));
  
  // Determine mention type
  let mentionType: string;
  if (!mentioned) {
    mentionType = 'ABSENT';
  } else if (negativeCount >= 2) {
    mentionType = 'NEGATIVE';
  } else if (mentionCount >= 3) {
    mentionType = 'PRIMARY';
  } else if (mentionCount >= 2) {
    mentionType = 'FEATURED';
  } else if (competitors.some(c => lowerText.includes(c.toLowerCase()))) {
    mentionType = 'COMPARISON';
  } else {
    mentionType = 'BRIEF';
  }
  
  // Find competitors mentioned
  const competitorsMentioned = competitors.filter(c => lowerText.includes(c.toLowerCase()));
  
  // Extract key phrases
  const keyPhrases = [
    ...POSITIVE_INDICATORS.filter(p => lowerText.includes(p)),
    ...NEGATIVE_INDICATORS.filter(n => lowerText.includes(n)),
  ].slice(0, 5);
  
  // Look for ranking
  let ranking: number | null = null;
  const rankingMatch = responseText.match(/(\d+)\.\s*\*?\*?([^*\n]+)/);
  if (rankingMatch && lowerText.indexOf(lowerBusiness) > -1) {
    const position = parseInt(rankingMatch[1]);
    if (position <= 10) ranking = position;
  }
  
  // Look for citations
  const urlMatch = responseText.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi);
  const citedUrl = urlMatch?.find(url => url.toLowerCase().includes(lowerBusiness.replace(/\s+/g, ''))) || null;
  const citedSources = urlMatch || [];
  
  return {
    mentioned,
    mentionType,
    mentionContext,
    mentionCount,
    sentiment,
    sentimentScore,
    confidenceScore,
    hasHedging,
    hedgingPhrases,
    isRecommended,
    recommendationStrength,
    ranking,
    citedUrl,
    citedSources,
    competitorsMentioned,
    keyPhrases,
    positiveIndicators: POSITIVE_INDICATORS.filter(p => lowerText.includes(p)),
    negativeIndicators: NEGATIVE_INDICATORS.filter(n => lowerText.includes(n)),
  };
}

// ===========================================
// SCORING FUNCTIONS
// ===========================================

function calculateScores(analyses: any[]) {
  const total = analyses.length;
  if (total === 0) {
    return {
      overall_score: 0,
      ai_trust_score: 0,
      ai_visibility_score: 0,
      ai_recommendation_score: 0,
      ai_citation_score: 0,
      sentiment_score: 50,
      confidence_score: 50,
    };
  }
  
  // Visibility
  const mentionedCount = analyses.filter(a => a.mentioned).length;
  const visibilityRate = mentionedCount / total;
  const ai_visibility_score = Math.round(visibilityRate * 100);
  
  // Sentiment
  const avgSentiment = analyses.reduce((sum, a) => sum + a.sentimentScore, 0) / total;
  const sentiment_score = Math.round(((avgSentiment + 1) / 2) * 100);
  
  // Confidence
  const avgConfidence = analyses.reduce((sum, a) => sum + a.confidenceScore, 0) / total;
  const confidence_score = Math.round(avgConfidence * 100);
  
  // Recommendation
  const recommendedCount = analyses.filter(a => a.isRecommended).length;
  const ai_recommendation_score = Math.round((recommendedCount / total) * 100);
  
  // Citation
  const citedCount = analyses.filter(a => a.citedUrl).length;
  const ai_citation_score = Math.round((citedCount / total) * 100);
  
  // Trust (composite)
  const hedgingRate = analyses.filter(a => a.hasHedging).length / total;
  const ai_trust_score = Math.round(
    sentiment_score * 0.35 +
    (100 - hedgingRate * 100) * 0.30 +
    ai_recommendation_score * 0.25 +
    (analyses.filter(a => a.mentionType !== 'NEGATIVE').length / total * 100) * 0.10
  );
  
  // Overall
  const overall_score = Math.round(
    ai_trust_score * 0.25 +
    ai_visibility_score * 0.20 +
    ai_recommendation_score * 0.20 +
    ai_citation_score * 0.10 +
    sentiment_score * 0.15 +
    confidence_score * 0.10
  );
  
  return {
    overall_score,
    ai_trust_score,
    ai_visibility_score,
    ai_recommendation_score,
    ai_citation_score,
    sentiment_score,
    confidence_score,
  };
}

// ===========================================
// PROMPT GENERATION
// ===========================================

function generatePrompts(business: any) {
  const prompts: { prompt: string; type: string; priority: string }[] = [];
  
  const name = business.name;
  const category = business.category || 'services';
  const location = business.city ? `${business.city}${business.country ? ', ' + business.country : ''}` : null;
  const products = business.products || [];
  const services = business.services || [];
  
  // ===========================================
  // HIGH PRIORITY - Brand & Trust
  // ===========================================
  prompts.push(
    { prompt: `Tell me about ${name}`, type: 'BRAND_DIRECT', priority: 'HIGH' },
    { prompt: `What is ${name}?`, type: 'BRAND_DIRECT', priority: 'HIGH' },
    { prompt: `Is ${name} good?`, type: 'RECOMMENDATION', priority: 'HIGH' },
    { prompt: `Should I use ${name}?`, type: 'RECOMMENDATION', priority: 'HIGH' },
    { prompt: `Would you recommend ${name}?`, type: 'RECOMMENDATION', priority: 'HIGH' },
    { prompt: `Is ${name} trustworthy?`, type: 'TRUST_VERIFICATION', priority: 'HIGH' },
    { prompt: `Is ${name} legit?`, type: 'TRUST_VERIFICATION', priority: 'HIGH' },
    { prompt: `${name} reviews`, type: 'REVIEW_INQUIRY', priority: 'HIGH' },
    { prompt: `What do people say about ${name}?`, type: 'REVIEW_INQUIRY', priority: 'HIGH' },
  );
  
  // ===========================================
  // MEDIUM PRIORITY - Category & Discovery
  // ===========================================
  if (category) {
    prompts.push(
      { prompt: `Best ${category} companies`, type: 'CATEGORY_SEARCH', priority: 'MEDIUM' },
      { prompt: `Top ${category} services`, type: 'CATEGORY_SEARCH', priority: 'MEDIUM' },
      { prompt: `Who are the leading ${category} providers?`, type: 'INDUSTRY_LEADER', priority: 'MEDIUM' },
      { prompt: `Most trusted ${category} companies`, type: 'TRUST_VERIFICATION', priority: 'MEDIUM' },
    );
  }
  
  // ===========================================
  // LOCAL SEARCH - "Near me" queries
  // ===========================================
  if (location) {
    prompts.push(
      { prompt: `Best ${category} in ${location}`, type: 'LOCAL_SEARCH', priority: 'HIGH' },
      { prompt: `${category} near ${location}`, type: 'LOCAL_SEARCH', priority: 'MEDIUM' },
      { prompt: `Top rated ${category} in ${location}`, type: 'LOCAL_SEARCH', priority: 'MEDIUM' },
      { prompt: `Trusted ${category} ${location}`, type: 'LOCAL_SEARCH', priority: 'MEDIUM' },
    );
  }
  
  // ===========================================
  // PRODUCT/SHOPPING QUERIES (Module 7)
  // ===========================================
  if (products.length > 0) {
    for (const product of products.slice(0, 3)) {
      prompts.push(
        { prompt: `Is ${product} by ${name} worth it?`, type: 'PRODUCT_SEARCH', priority: 'MEDIUM' },
        { prompt: `Best ${product} to buy`, type: 'PRODUCT_SEARCH', priority: 'MEDIUM' },
        { prompt: `${product} reviews`, type: 'PRODUCT_SEARCH', priority: 'MEDIUM' },
      );
    }
    // Generic shopping
    prompts.push(
      { prompt: `Best products from ${name}`, type: 'PRODUCT_SEARCH', priority: 'MEDIUM' },
    );
  }
  
  // ===========================================
  // SERVICE QUERIES
  // ===========================================
  if (services.length > 0) {
    for (const service of services.slice(0, 2)) {
      prompts.push(
        { prompt: `Best ${service} provider`, type: 'SERVICE_INQUIRY', priority: 'MEDIUM' },
        { prompt: `Who offers the best ${service}?`, type: 'SERVICE_INQUIRY', priority: 'MEDIUM' },
      );
    }
  }
  
  // ===========================================
  // COMPETITOR COMPARISONS
  // ===========================================
  if (business.competitors && business.competitors.length > 0) {
    for (const comp of business.competitors.slice(0, 3)) {
      prompts.push(
        { prompt: `${name} vs ${comp}`, type: 'COMPARISON', priority: 'MEDIUM' },
        { prompt: `Should I choose ${name} or ${comp}?`, type: 'COMPARISON', priority: 'MEDIUM' },
      );
    }
  }
  
  // ===========================================
  // ALTERNATIVES & PRICING
  // ===========================================
  prompts.push(
    { prompt: `Alternatives to ${name}`, type: 'ALTERNATIVE_SEARCH', priority: 'LOW' },
    { prompt: `${name} pricing`, type: 'PRICING_INQUIRY', priority: 'LOW' },
    { prompt: `How much does ${name} cost?`, type: 'PRICING_INQUIRY', priority: 'LOW' },
  );
  
  return prompts;
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

    const { businessId, scanType = 'FULL', platforms = ['chatgpt', 'claude'] } = await req.json();

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get business
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (bizError || !business) {
      return new Response(
        JSON.stringify({ error: 'Business not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        business_id: businessId,
        scan_type: scanType,
        status: 'RUNNING',
        platforms,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanError) {
      throw new Error(`Failed to create scan: ${scanError.message}`);
    }

    // Generate prompts
    const prompts = generatePrompts(business);
    const limitedPrompts = scanType === 'QUICK' ? prompts.slice(0, 5) : prompts;

    // Query each platform with each prompt
    const results: any[] = [];
    const analyses: any[] = [];

    for (const { prompt, type, priority } of limitedPrompts) {
      for (const platform of platforms) {
        try {
          // Call AI query function
          const aiQueryUrl = `${supabaseUrl}/functions/v1/ai-query`;
          const queryRes = await fetch(aiQueryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ platform, prompt }),
          });

          if (!queryRes.ok) {
            console.error(`AI query failed for ${platform}: ${await queryRes.text()}`);
            continue;
          }

          const queryResult = await queryRes.json();
          
          // Analyze response
          const analysis = analyzeResponse(
            queryResult.response,
            business.name,
            business.competitors || []
          );
          
          analyses.push(analysis);

          // Store result
          const resultRecord = {
            prompt_id: null,
            business_id: businessId,
            scan_id: scan.id,
            platform,
            query: prompt,
            response: queryResult.response,
            mentioned: analysis.mentioned,
            mention_type: analysis.mentionType,
            mention_context: analysis.mentionContext,
            mention_count: analysis.mentionCount,
            sentiment: analysis.sentiment,
            sentiment_score: analysis.sentimentScore,
            confidence_score: analysis.confidenceScore,
            has_hedging: analysis.hasHedging,
            hedging_phrases: analysis.hedgingPhrases,
            is_recommended: analysis.isRecommended,
            recommendation_strength: analysis.recommendationStrength,
            ranking: analysis.ranking,
            cited_url: analysis.citedUrl,
            cited_sources: analysis.citedSources,
            competitors_mentioned: analysis.competitorsMentioned,
            key_phrases: analysis.keyPhrases,
            positive_indicators: analysis.positiveIndicators,
            negative_indicators: analysis.negativeIndicators,
            response_time_ms: queryResult.responseTimeMs,
            token_count: queryResult.tokenCount,
            model_used: queryResult.model,
          };

          results.push(resultRecord);

          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 500));

        } catch (err) {
          console.error(`Error querying ${platform}:`, err);
        }
      }
    }

    // Store all results
    if (results.length > 0) {
      const { error: resultsError } = await supabase
        .from('prompt_results')
        .insert(results);

      if (resultsError) {
        console.error('Failed to store results:', resultsError);
      }
    }

    // Calculate scores
    const scores = calculateScores(analyses);

    // Get previous score for comparison
    const { data: prevScore } = await supabase
      .from('scores')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Store scores
    const { data: newScore, error: scoreError } = await supabase
      .from('scores')
      .insert({
        business_id: businessId,
        scan_id: scan.id,
        ...scores,
        local_visibility_score: business.city ? 60 : 30,
        social_discovery_score: [business.instagram_handle, business.tiktok_handle, business.facebook_url].filter(Boolean).length * 25,
        review_strength_score: 50, // Would need review data
        website_optimization_score: business.website ? 60 : 0,
        technical_readiness_score: 50, // Would need audit
        category_authority_score: Math.round((scores.ai_trust_score + scores.ai_visibility_score) / 2),
        previous_score_id: prevScore?.id,
        overall_change: prevScore ? scores.overall_score - prevScore.overall_score : null,
      })
      .select()
      .single();

    // Generate highlights and issues
    const highlights: string[] = [];
    const criticalIssues: string[] = [];

    if (scores.ai_visibility_score >= 70) highlights.push('Strong AI visibility');
    if (scores.ai_trust_score >= 70) highlights.push('High AI trust signals');
    if (scores.ai_recommendation_score >= 60) highlights.push('Good recommendation rate');

    if (scores.ai_visibility_score < 30) criticalIssues.push('Very low AI visibility');
    if (scores.ai_trust_score < 30) criticalIssues.push('Trust issues detected');
    if (analyses.some(a => a.mentionType === 'NEGATIVE')) criticalIssues.push('Negative mentions found');

    // Update scan as complete
    await supabase
      .from('scans')
      .update({
        status: 'COMPLETED',
        prompts_count: limitedPrompts.length,
        results_count: results.length,
        scores,
        highlights,
        critical_issues: criticalIssues,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scan.id);

    // Create alerts if score dropped
    if (prevScore && scores.overall_score < prevScore.overall_score - 10) {
      await supabase.from('alerts').insert({
        user_id: business.user_id,
        business_id: businessId,
        alert_type: 'SCORE_DROP',
        severity: scores.overall_score < prevScore.overall_score - 20 ? 'CRITICAL' : 'WARNING',
        title: `Score dropped for ${business.name}`,
        message: `Overall score dropped from ${prevScore.overall_score} to ${scores.overall_score}`,
        data: { previousScore: prevScore.overall_score, newScore: scores.overall_score },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanId: scan.id,
        scores,
        resultsCount: results.length,
        highlights,
        criticalIssues,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scan Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
