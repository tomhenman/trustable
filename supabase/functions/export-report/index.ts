/**
 * Export Report Edge Function
 * 
 * Generate exportable reports in JSON or CSV format.
 * PDF generation would require additional library (puppeteer).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReportType = 'scan' | 'audit' | 'competitor' | 'full' | 'digest';
type ExportFormat = 'json' | 'csv';

interface ExportRequest {
  businessId: string;
  format: ExportFormat;
  reportType: ReportType;
  scanId?: string;
  auditId?: string;
  dateFrom?: string;
  dateTo?: string;
  whiteLabel?: boolean;
  brandName?: string;
}

// ===========================================
// CSV CONVERSION
// ===========================================

function toCSV(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) return '';
  
  const keys = headers || Object.keys(data[0]);
  const headerRow = keys.join(',');
  
  const rows = data.map(item => {
    return keys.map(key => {
      const val = item[key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
}

// ===========================================
// REPORT GENERATORS
// ===========================================

async function generateScanReport(supabase: any, businessId: string, scanId?: string) {
  let query = supabase
    .from('scans')
    .select(`
      *,
      scores:scores(*)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  
  if (scanId) {
    query = query.eq('id', scanId);
  }
  
  const { data: scans, error } = await query.limit(scanId ? 1 : 10);
  if (error) throw error;
  
  // Get results for these scans
  const scanIds = scans.map((s: any) => s.id);
  const { data: results } = await supabase
    .from('prompt_results')
    .select('*')
    .in('scan_id', scanIds);
  
  return {
    summary: {
      totalScans: scans.length,
      latestScore: scans[0]?.scores?.[0]?.overall_score,
      generatedAt: new Date().toISOString(),
    },
    scans: scans.map((scan: any) => ({
      id: scan.id,
      type: scan.scan_type,
      status: scan.status,
      platforms: scan.platforms,
      promptsCount: scan.prompts_count,
      resultsCount: scan.results_count,
      scores: scan.scores,
      highlights: scan.highlights,
      criticalIssues: scan.critical_issues,
      startedAt: scan.started_at,
      completedAt: scan.completed_at,
    })),
    results: results?.map((r: any) => ({
      platform: r.platform,
      query: r.query,
      mentioned: r.mentioned,
      mentionType: r.mention_type,
      sentiment: r.sentiment,
      isRecommended: r.is_recommended,
      ranking: r.ranking,
      createdAt: r.created_at,
    })),
  };
}

async function generateAuditReport(supabase: any, businessId: string, auditId?: string) {
  let query = supabase
    .from('site_audits')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  
  if (auditId) {
    query = query.eq('id', auditId);
  }
  
  const { data: audits, error } = await query.limit(auditId ? 1 : 5);
  if (error) throw error;
  
  return {
    summary: {
      totalAudits: audits.length,
      latestScore: audits[0]?.overall_score,
      generatedAt: new Date().toISOString(),
    },
    audits: audits.map((audit: any) => ({
      id: audit.id,
      websiteUrl: audit.website_url,
      overallScore: audit.overall_score,
      technicalScore: audit.technical_score,
      contentScore: audit.content_score,
      schemaScore: audit.schema_score,
      crawlabilityScore: audit.crawlability_score,
      pagesAnalyzed: audit.pages_analyzed,
      criticalIssues: audit.critical_issues,
      warnings: audit.warnings,
      passedChecks: audit.passed_checks,
      schemaTypes: audit.schema_types,
      missingSchema: audit.missing_schema,
      completedAt: audit.completed_at,
    })),
  };
}

async function generateCompetitorReport(supabase: any, businessId: string) {
  const { data: benchmarks, error: benchError } = await supabase
    .from('competitor_benchmarks')
    .select('*')
    .eq('business_id', businessId);
  
  if (benchError) throw benchError;
  
  const { data: sov, error: sovError } = await supabase
    .from('share_of_voice')
    .select('*')
    .eq('business_id', businessId)
    .order('period', { ascending: false })
    .limit(6);
  
  if (sovError) throw sovError;
  
  return {
    summary: {
      competitorsTracked: benchmarks.length,
      latestShareOfVoice: sov[0]?.share_of_voice,
      generatedAt: new Date().toISOString(),
    },
    benchmarks: benchmarks.map((b: any) => ({
      competitorName: b.competitor_name,
      estimatedScores: b.estimated_scores,
      visibilityDiff: b.visibility_diff,
      trustDiff: b.trust_diff,
      recommendationDiff: b.recommendation_diff,
      strengthAreas: b.strength_areas,
      weaknessAreas: b.weakness_areas,
      insights: b.insights,
      updatedAt: b.updated_at,
    })),
    shareOfVoice: sov.map((s: any) => ({
      period: s.period,
      yourMentions: s.total_mentions,
      categoryTotal: s.category_total_mentions,
      shareOfVoice: s.share_of_voice,
      competitorShares: s.competitor_shares,
    })),
  };
}

async function generateFullReport(supabase: any, businessId: string) {
  // Get business info
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
  
  if (bizError) throw bizError;
  
  // Get latest score
  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1);
  
  const latestScore = scores?.[0];
  
  // Get recommendations
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'PENDING')
    .order('priority');
  
  // Get scan history
  const scanReport = await generateScanReport(supabase, businessId);
  
  // Get audit history
  const auditReport = await generateAuditReport(supabase, businessId);
  
  // Get competitor data
  const competitorReport = await generateCompetitorReport(supabase, businessId);
  
  return {
    generatedAt: new Date().toISOString(),
    business: {
      name: business.name,
      category: business.category,
      website: business.website,
      location: business.city ? `${business.city}, ${business.country}` : null,
    },
    currentScores: latestScore ? {
      overall: latestScore.overall_score,
      aiTrust: latestScore.ai_trust_score,
      aiVisibility: latestScore.ai_visibility_score,
      aiRecommendation: latestScore.ai_recommendation_score,
      aiCitation: latestScore.ai_citation_score,
      sentiment: latestScore.sentiment_score,
      shareOfVoice: latestScore.share_of_voice,
    } : null,
    recommendations: recommendations?.map((r: any) => ({
      category: r.category,
      priority: r.priority,
      title: r.title,
      description: r.description,
      estimatedImpact: r.estimated_impact,
    })),
    scans: scanReport,
    audits: auditReport,
    competitors: competitorReport,
  };
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

    const { 
      businessId, 
      format = 'json', 
      reportType = 'full',
      scanId,
      auditId,
      whiteLabel = false,
      brandName,
    }: ExportRequest = await req.json();

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check plan allows export
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id, name')
      .eq('id', businessId)
      .single();

    if (!business) {
      return new Response(
        JSON.stringify({ error: 'Business not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan')
      .eq('id', business.user_id)
      .single();

    if (!['PROFESSIONAL', 'SCALE', 'CUSTOM'].includes(profile?.plan || '')) {
      return new Response(
        JSON.stringify({ error: 'Export requires Professional plan or higher' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate report
    let reportData: any;
    switch (reportType) {
      case 'scan':
        reportData = await generateScanReport(supabase, businessId, scanId);
        break;
      case 'audit':
        reportData = await generateAuditReport(supabase, businessId, auditId);
        break;
      case 'competitor':
        reportData = await generateCompetitorReport(supabase, businessId);
        break;
      case 'full':
      default:
        reportData = await generateFullReport(supabase, businessId);
    }

    // White-label (remove Trustable branding)
    if (whiteLabel && ['SCALE', 'CUSTOM'].includes(profile?.plan || '')) {
      reportData.generatedBy = brandName || 'AI Visibility Report';
    } else {
      reportData.generatedBy = 'Trustable - AI Visibility Platform';
    }

    // Format output
    if (format === 'csv') {
      // Flatten for CSV
      let csvData: any[] = [];
      let csvContent = '';

      if (reportType === 'scan' && reportData.results) {
        csvContent = toCSV(reportData.results);
      } else if (reportType === 'audit' && reportData.audits) {
        csvContent = toCSV(reportData.audits);
      } else if (reportType === 'competitor' && reportData.benchmarks) {
        csvContent = toCSV(reportData.benchmarks);
      } else {
        // For full report, export scores
        csvContent = toCSV([reportData.currentScores || {}]);
      }

      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${business.name}-${reportType}-report.csv"`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        format: 'json',
        reportType,
        data: reportData,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Export Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
