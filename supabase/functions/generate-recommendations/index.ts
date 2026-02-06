/**
 * Generate Recommendations Edge Function
 * 
 * Auto-generates actionable recommendations based on:
 * - Latest scan results
 * - Site audit findings
 * - Score analysis
 * - Competitor gaps
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recommendation {
  category: string;
  priority: string;
  title: string;
  description: string;
  reasoning: string;
  action_steps: { order: number; title: string; description: string }[];
  impact_areas: string[];
  estimated_impact: number;
  estimated_effort: string;
  estimated_time_minutes: number;
}

// ===========================================
// RECOMMENDATION RULES
// ===========================================

function generateFromScores(scores: any, business: any): Recommendation[] {
  const recs: Recommendation[] = [];
  
  // Critical: Very low visibility
  if (scores.ai_visibility_score < 30) {
    recs.push({
      category: 'CONTENT_CREATION',
      priority: 'CRITICAL',
      title: 'Create foundational content for AI discovery',
      description: `Your AI visibility score is only ${scores.ai_visibility_score}%. AI systems don't know enough about ${business.name} to mention you.`,
      reasoning: 'AI systems rely on web content to learn about businesses. Without comprehensive content, they cannot recommend you.',
      action_steps: [
        { order: 1, title: 'Create About page', description: 'Write a detailed About page explaining who you are and what you do' },
        { order: 2, title: 'Add FAQ section', description: 'Answer common questions about your business' },
        { order: 3, title: 'Publish service pages', description: 'Create individual pages for each service you offer' },
      ],
      impact_areas: ['ai_visibility', 'ai_trust'],
      estimated_impact: 25,
      estimated_effort: 'MEDIUM',
      estimated_time_minutes: 180,
    });
  }

  // High: Low trust score
  if (scores.ai_trust_score < 50) {
    recs.push({
      category: 'AUTHORITY_BUILDING',
      priority: 'HIGH',
      title: 'Build trust signals for AI systems',
      description: `AI systems are uncertain about recommending ${business.name}. Your trust score is ${scores.ai_trust_score}%.`,
      reasoning: 'AI uses hedging language when uncertain about a business. Clear, authoritative content reduces this.',
      action_steps: [
        { order: 1, title: 'Add credentials', description: 'List certifications, awards, and qualifications' },
        { order: 2, title: 'Include case studies', description: 'Add specific examples of successful projects' },
        { order: 3, title: 'Display testimonials', description: 'Feature customer reviews on your website' },
      ],
      impact_areas: ['ai_trust', 'ai_recommendation'],
      estimated_impact: 15,
      estimated_effort: 'MEDIUM',
      estimated_time_minutes: 120,
    });
  }

  // High: Low recommendation score
  if (scores.ai_recommendation_score < 40) {
    recs.push({
      category: 'CONTENT_CREATION',
      priority: 'HIGH',
      title: 'Optimize content for AI recommendations',
      description: `AI rarely recommends ${business.name} (only ${scores.ai_recommendation_score}% of the time).`,
      reasoning: 'AI needs clear signals that you are a good choice. Comparison content and benefit-focused writing helps.',
      action_steps: [
        { order: 1, title: 'Create comparison content', description: 'Write "Why choose us" and comparison pages' },
        { order: 2, title: 'Highlight unique value', description: 'Clearly state what makes you different' },
        { order: 3, title: 'Add specific benefits', description: 'List concrete outcomes customers achieve' },
      ],
      impact_areas: ['ai_recommendation'],
      estimated_impact: 20,
      estimated_effort: 'LOW',
      estimated_time_minutes: 90,
    });
  }

  // Medium: Low citation score
  if (scores.ai_citation_score < 30) {
    recs.push({
      category: 'TECHNICAL_SEO',
      priority: 'MEDIUM',
      title: 'Improve content for AI citation',
      description: `AI systems rarely cite your website (${scores.ai_citation_score}% citation rate).`,
      reasoning: 'Being cited as a source gives you authority. Structured, factual content gets cited more.',
      action_steps: [
        { order: 1, title: 'Add data and statistics', description: 'Include specific numbers and facts' },
        { order: 2, title: 'Create resource content', description: 'Write comprehensive guides and how-tos' },
        { order: 3, title: 'Structure with headers', description: 'Use clear H2/H3 structure for easy extraction' },
      ],
      impact_areas: ['ai_citation', 'ai_trust'],
      estimated_impact: 10,
      estimated_effort: 'MEDIUM',
      estimated_time_minutes: 120,
    });
  }

  // Medium: Poor sentiment
  if (scores.sentiment_score < 50) {
    recs.push({
      category: 'CRISIS_MANAGEMENT',
      priority: 'HIGH',
      title: 'Address negative AI perception',
      description: `AI responses about ${business.name} have negative sentiment (${scores.sentiment_score}%).`,
      reasoning: 'Negative content online is affecting how AI describes you. This needs immediate attention.',
      action_steps: [
        { order: 1, title: 'Audit online presence', description: 'Search for negative content about your brand' },
        { order: 2, title: 'Request review removal', description: 'Address any unfair or fake negative reviews' },
        { order: 3, title: 'Create positive content', description: 'Publish success stories and positive news' },
      ],
      impact_areas: ['sentiment', 'ai_trust'],
      estimated_impact: 20,
      estimated_effort: 'HIGH',
      estimated_time_minutes: 240,
    });
  }

  return recs;
}

function generateFromAudit(audit: any, business: any): Recommendation[] {
  const recs: Recommendation[] = [];
  
  // Critical: No schema
  if (audit.schema_score < 30) {
    recs.push({
      category: 'SCHEMA_MARKUP',
      priority: 'CRITICAL',
      title: 'Add schema markup for AI understanding',
      description: 'Your website lacks structured data that helps AI systems understand your business.',
      reasoning: 'Schema markup is machine-readable data that AI uses to extract facts about businesses.',
      action_steps: [
        { order: 1, title: 'Add Organization schema', description: 'Add JSON-LD for your organization details' },
        { order: 2, title: 'Add LocalBusiness schema', description: 'Include location and contact data' },
        { order: 3, title: 'Add FAQ schema', description: 'Mark up your FAQ page for rich results' },
      ],
      impact_areas: ['technical_readiness', 'ai_visibility'],
      estimated_impact: 20,
      estimated_effort: 'LOW',
      estimated_time_minutes: 60,
    });
  }

  // Issues from audit
  const criticalIssues = audit.critical_issues || [];
  for (const issue of criticalIssues.slice(0, 3)) {
    recs.push({
      category: issue.category || 'TECHNICAL_SEO',
      priority: 'CRITICAL',
      title: issue.title,
      description: issue.description,
      reasoning: 'This was flagged as a critical issue in your site audit.',
      action_steps: [
        { order: 1, title: 'Fix this issue', description: issue.howToFix || 'Follow technical best practices' },
      ],
      impact_areas: ['technical_readiness'],
      estimated_impact: 15,
      estimated_effort: 'MEDIUM',
      estimated_time_minutes: 45,
    });
  }

  // Thin content
  if (audit.content_score < 50) {
    recs.push({
      category: 'WEBSITE_CONTENT',
      priority: 'HIGH',
      title: 'Expand website content depth',
      description: 'Your pages have thin content. AI prefers comprehensive, detailed pages.',
      reasoning: 'Pages with more depth are more likely to be cited and trusted by AI systems.',
      action_steps: [
        { order: 1, title: 'Audit page lengths', description: 'Identify pages under 500 words' },
        { order: 2, title: 'Expand key pages', description: 'Add more detail to About, Services, and product pages' },
        { order: 3, title: 'Add supporting content', description: 'Create blog posts and guides' },
      ],
      impact_areas: ['ai_citation', 'ai_visibility'],
      estimated_impact: 15,
      estimated_effort: 'HIGH',
      estimated_time_minutes: 300,
    });
  }

  return recs;
}

function generateFromCompetitors(benchmarks: any[], business: any): Recommendation[] {
  const recs: Recommendation[] = [];
  
  // Find areas where competitors beat you
  for (const benchmark of benchmarks) {
    if (benchmark.visibility_diff < -15) {
      recs.push({
        category: 'COMPETITOR_RESPONSE',
        priority: 'HIGH',
        title: `Improve visibility vs ${benchmark.competitor_name}`,
        description: `${benchmark.competitor_name} has ${Math.abs(benchmark.visibility_diff)}% higher AI visibility than you.`,
        reasoning: 'When competitors are more visible, they capture potential customers who ask AI for recommendations.',
        action_steps: [
          { order: 1, title: 'Analyze competitor content', description: `Study what ${benchmark.competitor_name} does well` },
          { order: 2, title: 'Create comparative content', description: 'Write content comparing your strengths' },
        ],
        impact_areas: ['ai_visibility', 'share_of_voice'],
        estimated_impact: 15,
        estimated_effort: 'MEDIUM',
        estimated_time_minutes: 120,
      });
    }
  }

  return recs;
}

function generateFromBusiness(business: any): Recommendation[] {
  const recs: Recommendation[] = [];
  
  // Missing website
  if (!business.website) {
    recs.push({
      category: 'PROFILE_COMPLETION',
      priority: 'CRITICAL',
      title: 'Add your website',
      description: 'Without a website, AI systems cannot learn about your business.',
      reasoning: 'AI needs web content to understand and recommend businesses.',
      action_steps: [
        { order: 1, title: 'Add website URL', description: 'Update your business profile with your website' },
      ],
      impact_areas: ['ai_visibility', 'ai_trust', 'ai_recommendation'],
      estimated_impact: 30,
      estimated_effort: 'LOW',
      estimated_time_minutes: 5,
    });
  }

  // Missing location
  if (!business.city && business.category?.toLowerCase().includes('local')) {
    recs.push({
      category: 'LOCAL_OPTIMIZATION',
      priority: 'HIGH',
      title: 'Add business location',
      description: 'Local businesses need location data for AI to recommend them for local queries.',
      reasoning: 'When someone asks "best X near me", AI needs your location to include you.',
      action_steps: [
        { order: 1, title: 'Add address', description: 'Update your business profile with full address' },
        { order: 2, title: 'Add service area', description: 'Specify the areas you serve' },
      ],
      impact_areas: ['local_visibility'],
      estimated_impact: 20,
      estimated_effort: 'LOW',
      estimated_time_minutes: 10,
    });
  }

  // No social presence
  const socialFields = [
    business.instagram_handle,
    business.facebook_url,
    business.linkedin_url,
    business.twitter_handle,
  ];
  if (socialFields.filter(Boolean).length < 2) {
    recs.push({
      category: 'SOCIAL_PRESENCE',
      priority: 'MEDIUM',
      title: 'Build social media presence',
      description: 'A stronger social presence helps AI verify your business legitimacy.',
      reasoning: 'AI cross-references social profiles to validate businesses and build trust.',
      action_steps: [
        { order: 1, title: 'Create/link profiles', description: 'Set up Instagram, LinkedIn, and Facebook' },
        { order: 2, title: 'Add to website', description: 'Link social profiles from your website' },
      ],
      impact_areas: ['social_discovery', 'ai_trust'],
      estimated_impact: 10,
      estimated_effort: 'LOW',
      estimated_time_minutes: 30,
    });
  }

  // No competitors defined
  if (!business.competitors || business.competitors.length === 0) {
    recs.push({
      category: 'PROFILE_COMPLETION',
      priority: 'LOW',
      title: 'Add competitors to track',
      description: 'Track competitors to understand your relative AI visibility.',
      reasoning: 'Knowing where you stand vs competitors helps prioritize improvements.',
      action_steps: [
        { order: 1, title: 'Add competitors', description: 'Add 3-5 main competitors to your profile' },
      ],
      impact_areas: ['share_of_voice'],
      estimated_impact: 5,
      estimated_effort: 'LOW',
      estimated_time_minutes: 5,
    });
  }

  return recs;
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

    const { businessId, scanId, auditId } = await req.json();

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

    const recommendations: Recommendation[] = [];

    // Generate from business profile
    recommendations.push(...generateFromBusiness(business));

    // Get latest scores
    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (scores) {
      recommendations.push(...generateFromScores(scores, business));
    }

    // Get latest audit
    let auditQuery = supabase
      .from('site_audits')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(1);

    if (auditId) {
      auditQuery = supabase
        .from('site_audits')
        .select('*')
        .eq('id', auditId);
    }

    const { data: audit } = await auditQuery.single();
    if (audit) {
      recommendations.push(...generateFromAudit(audit, business));
    }

    // Get competitor benchmarks
    const { data: benchmarks } = await supabase
      .from('competitor_benchmarks')
      .select('*')
      .eq('business_id', businessId);

    if (benchmarks && benchmarks.length > 0) {
      recommendations.push(...generateFromCompetitors(benchmarks, business));
    }

    // Deduplicate by title
    const uniqueRecs = recommendations.reduce((acc: Recommendation[], rec) => {
      if (!acc.find(r => r.title === rec.title)) {
        acc.push(rec);
      }
      return acc;
    }, []);

    // Sort by priority
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    uniqueRecs.sort((a, b) => 
      (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - 
      (priorityOrder[b.priority as keyof typeof priorityOrder] || 4)
    );

    // Store in database
    const recsToInsert = uniqueRecs.map(rec => ({
      business_id: businessId,
      ...rec,
      status: 'PENDING',
    }));

    // Clear old pending recommendations first
    await supabase
      .from('recommendations')
      .delete()
      .eq('business_id', businessId)
      .eq('status', 'PENDING');

    // Insert new ones
    const { error: insertError } = await supabase
      .from('recommendations')
      .insert(recsToInsert);

    if (insertError) {
      console.error('Failed to insert recommendations:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recommendationsCreated: uniqueRecs.length,
        recommendations: uniqueRecs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Recommendations Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
