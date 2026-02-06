/**
 * Competitor Scan Edge Function
 * 
 * Scans competitors and compares against your business:
 * - Runs queries for competitors
 * - Calculates relative scores
 * - Updates benchmarks
 * - Calculates share of voice
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple analysis for competitors
function analyzeCompetitorResponse(response: string, competitorName: string) {
  const lowerText = response.toLowerCase();
  const lowerName = competitorName.toLowerCase();
  
  const mentioned = lowerText.includes(lowerName);
  const mentionCount = (response.match(new RegExp(lowerName, 'gi')) || []).length;
  
  const positiveWords = ['excellent', 'great', 'recommend', 'trusted', 'best', 'quality'];
  const negativeWords = ['complaints', 'issues', 'avoid', 'poor', 'negative'];
  
  const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
  
  const sentimentScore = (positiveCount - negativeCount) / Math.max(1, positiveCount + negativeCount);
  
  const isRecommended = lowerText.includes('recommend') && negativeCount === 0;
  
  return {
    mentioned,
    mentionCount,
    sentimentScore,
    isRecommended,
    positiveCount,
    negativeCount,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { businessId, competitorName } = await req.json();

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

    // Get your latest scores
    const { data: yourScore } = await supabase
      .from('scores')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!yourScore) {
      return new Response(
        JSON.stringify({ error: 'Run a scan for your business first' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine competitors to scan
    const competitorsToScan = competitorName 
      ? [competitorName] 
      : (business.competitors || []).slice(0, 5);

    if (competitorsToScan.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No competitors configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiQueryUrl = `${supabaseUrl}/functions/v1/ai-query`;
    const benchmarks: any[] = [];
    const allMentionData: any[] = [];

    // Scan each competitor
    for (const competitor of competitorsToScan) {
      const competitorAnalyses: any[] = [];
      
      // Generate queries for competitor
      const queries = [
        `Tell me about ${competitor}`,
        `Is ${competitor} good?`,
        `Would you recommend ${competitor}?`,
        `${competitor} reviews`,
      ];

      // Also run category queries to measure share of voice
      if (business.category) {
        queries.push(`Best ${business.category} companies`);
      }

      for (const query of queries) {
        try {
          // Query ChatGPT for competitor
          const res = await fetch(aiQueryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ platform: 'chatgpt', prompt: query }),
          });

          if (res.ok) {
            const result = await res.json();
            const analysis = analyzeCompetitorResponse(result.response, competitor);
            competitorAnalyses.push(analysis);

            // Track for share of voice
            allMentionData.push({
              query,
              competitor,
              yourMentioned: result.response.toLowerCase().includes(business.name.toLowerCase()),
              competitorMentioned: analysis.mentioned,
            });
          }

          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error(`Query failed for ${competitor}:`, err);
        }
      }

      // Calculate competitor scores
      if (competitorAnalyses.length > 0) {
        const total = competitorAnalyses.length;
        const mentionRate = competitorAnalyses.filter(a => a.mentioned).length / total;
        const avgSentiment = competitorAnalyses.reduce((sum, a) => sum + a.sentimentScore, 0) / total;
        const recommendRate = competitorAnalyses.filter(a => a.isRecommended).length / total;

        const estVisibility = Math.round(mentionRate * 100);
        const estTrust = Math.round(((avgSentiment + 1) / 2) * 70 + recommendRate * 30);
        const estRecommendation = Math.round(recommendRate * 100);

        // Calculate differences
        const visibilityDiff = yourScore.ai_visibility_score - estVisibility;
        const trustDiff = yourScore.ai_trust_score - estTrust;
        const recommendationDiff = yourScore.ai_recommendation_score - estRecommendation;

        // Determine strengths/weaknesses
        const strengthAreas: string[] = [];
        const weaknessAreas: string[] = [];
        const insights: string[] = [];

        if (visibilityDiff > 10) strengthAreas.push('AI Visibility');
        else if (visibilityDiff < -10) {
          weaknessAreas.push('AI Visibility');
          insights.push(`${competitor} has higher AI visibility`);
        }

        if (trustDiff > 10) strengthAreas.push('AI Trust');
        else if (trustDiff < -10) {
          weaknessAreas.push('AI Trust');
          insights.push(`${competitor} has stronger trust signals`);
        }

        if (recommendationDiff > 10) strengthAreas.push('Recommendations');
        else if (recommendationDiff < -10) {
          weaknessAreas.push('Recommendations');
          insights.push(`${competitor} gets recommended more often`);
        }

        // Upsert benchmark
        const { error: benchError } = await supabase
          .from('competitor_benchmarks')
          .upsert({
            business_id: businessId,
            competitor_name: competitor,
            estimated_scores: {
              visibility: estVisibility,
              trust: estTrust,
              recommendation: estRecommendation,
            },
            visibility_diff: visibilityDiff,
            trust_diff: trustDiff,
            recommendation_diff: recommendationDiff,
            sentiment_diff: Math.round(yourScore.sentiment_score - ((avgSentiment + 1) / 2) * 100),
            strength_areas: strengthAreas,
            weakness_areas: weaknessAreas,
            insights,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'business_id,competitor_name',
          });

        benchmarks.push({
          competitor,
          yourScores: {
            visibility: yourScore.ai_visibility_score,
            trust: yourScore.ai_trust_score,
            recommendation: yourScore.ai_recommendation_score,
          },
          competitorScores: {
            visibility: estVisibility,
            trust: estTrust,
            recommendation: estRecommendation,
          },
          differences: {
            visibility: visibilityDiff,
            trust: trustDiff,
            recommendation: recommendationDiff,
          },
          strengthAreas,
          weaknessAreas,
          insights,
        });

        // Create alert if competitor overtook
        if (visibilityDiff < -20 || trustDiff < -20) {
          await supabase.from('alerts').insert({
            user_id: business.user_id,
            business_id: businessId,
            alert_type: 'COMPETITOR_OVERTAKE',
            severity: 'WARNING',
            title: `${competitor} has stronger AI presence`,
            message: `${competitor} now ranks higher than you in AI visibility or trust.`,
            data: { competitor, differences: { visibilityDiff, trustDiff } },
          });
        }
      }
    }

    // Calculate share of voice
    const categoryQueries = allMentionData.filter(d => d.query.includes('Best'));
    if (categoryQueries.length > 0) {
      const yourMentions = categoryQueries.filter(d => d.yourMentioned).length;
      const totalMentions = categoryQueries.length;
      
      const competitorMentions: Record<string, number> = {};
      for (const comp of competitorsToScan) {
        competitorMentions[comp] = categoryQueries.filter(d => d.competitor === comp && d.competitorMentioned).length;
      }

      const totalAllMentions = yourMentions + Object.values(competitorMentions).reduce((a, b) => a + b, 0);
      const shareOfVoice = totalAllMentions > 0 ? (yourMentions / totalAllMentions) * 100 : 0;

      // Get current month
      const period = new Date().toISOString().substring(0, 7);

      // Upsert share of voice
      await supabase.from('share_of_voice').upsert({
        business_id: businessId,
        period,
        total_mentions: yourMentions,
        category_total_mentions: totalAllMentions,
        share_of_voice: Math.round(shareOfVoice * 10) / 10,
        competitor_shares: Object.entries(competitorMentions).map(([name, mentions]) => ({
          name,
          mentions,
          shareOfVoice: totalAllMentions > 0 ? Math.round((mentions / totalAllMentions) * 1000) / 10 : 0,
        })),
      }, {
        onConflict: 'business_id,period',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        competitorsScanned: competitorsToScan.length,
        benchmarks,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Competitor Scan Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
