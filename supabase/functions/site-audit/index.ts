/**
 * Site Audit Edge Function
 * 
 * Audits a website for AI-optimization factors:
 * - Schema markup presence
 * - Content structure
 * - Meta tags
 * - Crawlability signals
 * - Page quality
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditIssue {
  category: 'TECHNICAL' | 'CONTENT' | 'SCHEMA' | 'PERFORMANCE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  howToFix: string;
  affectedUrl?: string;
}

interface PageResult {
  url: string;
  title: string;
  metaDescription: string;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  hasSchema: boolean;
  schemaTypes: string[];
  issues: string[];
  score: number;
}

// ===========================================
// FETCH WITH TIMEOUT
// ===========================================

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TrustableBot/1.0 (AI Visibility Audit)',
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// ===========================================
// AUDIT FUNCTIONS
// ===========================================

async function auditPage(url: string): Promise<{ html: string; loadTime: number } | null> {
  try {
    const start = Date.now();
    const response = await fetchWithTimeout(url);
    const loadTime = Date.now() - start;
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    return { html, loadTime };
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

function analyzeHTML(html: string, url: string): PageResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const issues: string[] = [];
  let score = 50;
  
  // Title
  const titleEl = doc?.querySelector('title');
  const title = titleEl?.textContent || '';
  
  if (!title) {
    issues.push('Missing page title');
    score -= 15;
  } else if (title.length < 30) {
    issues.push('Title too short');
    score -= 5;
  } else if (title.length > 60) {
    issues.push('Title may be truncated in search results');
    score -= 3;
  } else {
    score += 10;
  }
  
  // Meta description
  const metaDesc = doc?.querySelector('meta[name="description"]');
  const metaDescription = metaDesc?.getAttribute('content') || '';
  
  if (!metaDescription) {
    issues.push('Missing meta description');
    score -= 10;
  } else if (metaDescription.length < 70) {
    issues.push('Meta description too short');
    score -= 5;
  } else if (metaDescription.length > 160) {
    issues.push('Meta description may be truncated');
    score -= 3;
  } else {
    score += 10;
  }
  
  // H1
  const h1s = doc?.querySelectorAll('h1') || [];
  const h1Count = h1s.length;
  
  if (h1Count === 0) {
    issues.push('Missing H1 heading');
    score -= 10;
  } else if (h1Count > 1) {
    issues.push('Multiple H1 headings');
    score -= 5;
  } else {
    score += 10;
  }
  
  // H2
  const h2s = doc?.querySelectorAll('h2') || [];
  const h2Count = h2s.length;
  
  if (h2Count < 2) {
    issues.push('Few section headings (H2)');
    score -= 5;
  } else {
    score += 5;
  }
  
  // Content
  const body = doc?.querySelector('body');
  const textContent = body?.textContent || '';
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 2).length;
  
  if (wordCount < 300) {
    issues.push('Thin content (less than 300 words)');
    score -= 15;
  } else if (wordCount >= 800) {
    score += 10;
  } else {
    score += 5;
  }
  
  // Schema
  const schemaScripts = doc?.querySelectorAll('script[type="application/ld+json"]') || [];
  const schemaTypes: string[] = [];
  
  schemaScripts.forEach((script: any) => {
    try {
      const json = JSON.parse(script.textContent || '{}');
      if (json['@type']) {
        schemaTypes.push(json['@type']);
      } else if (Array.isArray(json)) {
        json.forEach((item: any) => {
          if (item['@type']) schemaTypes.push(item['@type']);
        });
      }
    } catch (e) {
      // Invalid JSON
    }
  });
  
  const hasSchema = schemaTypes.length > 0;
  
  if (!hasSchema) {
    issues.push('No schema markup found');
    score -= 10;
  } else {
    score += 15;
  }
  
  // Canonical
  const canonical = doc?.querySelector('link[rel="canonical"]');
  if (!canonical) {
    issues.push('Missing canonical URL');
    score -= 5;
  }
  
  // Viewport
  const viewport = doc?.querySelector('meta[name="viewport"]');
  if (!viewport) {
    issues.push('Missing viewport meta (mobile issues)');
    score -= 10;
  }
  
  return {
    url,
    title,
    metaDescription,
    h1Count,
    h2Count,
    wordCount,
    hasSchema,
    schemaTypes,
    issues,
    score: Math.max(0, Math.min(100, score)),
  };
}

function generateAuditIssues(pageResults: PageResult[], websiteUrl: string): {
  critical: AuditIssue[];
  warnings: AuditIssue[];
  passed: { name: string; description: string }[];
} {
  const critical: AuditIssue[] = [];
  const warnings: AuditIssue[] = [];
  const passed: { name: string; description: string }[] = [];
  
  // Aggregate issues
  const hasSchema = pageResults.some(p => p.hasSchema);
  const avgWordCount = pageResults.reduce((sum, p) => sum + p.wordCount, 0) / pageResults.length;
  const missingTitles = pageResults.filter(p => !p.title).length;
  const missingMeta = pageResults.filter(p => !p.metaDescription).length;
  const missingH1 = pageResults.filter(p => p.h1Count === 0).length;
  
  // Schema
  if (!hasSchema) {
    critical.push({
      category: 'SCHEMA',
      severity: 'CRITICAL',
      title: 'No Schema Markup Found',
      description: 'Your website lacks structured data (schema.org markup) which helps AI understand your content.',
      howToFix: 'Add JSON-LD schema markup for Organization, LocalBusiness, or relevant types to your pages.',
    });
  } else {
    passed.push({
      name: 'Schema Markup Present',
      description: 'Your website has structured data that helps AI understand your content.',
    });
  }
  
  // Titles
  if (missingTitles > 0) {
    critical.push({
      category: 'CONTENT',
      severity: 'CRITICAL',
      title: `${missingTitles} Page(s) Missing Title Tags`,
      description: 'Title tags are essential for AI to understand what each page is about.',
      howToFix: 'Add unique, descriptive title tags to all pages (50-60 characters recommended).',
    });
  } else {
    passed.push({
      name: 'All Pages Have Titles',
      description: 'Every audited page has a title tag.',
    });
  }
  
  // Meta descriptions
  if (missingMeta > 0) {
    warnings.push({
      category: 'CONTENT',
      severity: 'WARNING',
      title: `${missingMeta} Page(s) Missing Meta Descriptions`,
      description: 'Meta descriptions help AI and search engines understand your page content.',
      howToFix: 'Add meta descriptions to all pages (120-155 characters recommended).',
    });
  } else {
    passed.push({
      name: 'All Pages Have Meta Descriptions',
      description: 'Every audited page has a meta description.',
    });
  }
  
  // H1s
  if (missingH1 > 0) {
    warnings.push({
      category: 'CONTENT',
      severity: 'WARNING',
      title: `${missingH1} Page(s) Missing H1 Headings`,
      description: 'H1 headings signal the main topic of a page to AI systems.',
      howToFix: 'Add a single, descriptive H1 heading to each page.',
    });
  }
  
  // Content depth
  if (avgWordCount < 400) {
    warnings.push({
      category: 'CONTENT',
      severity: 'WARNING',
      title: 'Thin Content Detected',
      description: `Average page word count is ${Math.round(avgWordCount)}. AI prefers comprehensive content.`,
      howToFix: 'Expand your content to be more comprehensive (aim for 800+ words on key pages).',
    });
  } else {
    passed.push({
      name: 'Good Content Depth',
      description: 'Your pages have substantial content for AI to analyze and cite.',
    });
  }
  
  return { critical, warnings, passed };
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

    const { businessId } = await req.json();

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

    if (bizError || !business || !business.website) {
      return new Response(
        JSON.stringify({ error: 'Business not found or no website configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const websiteUrl = business.website.startsWith('http') 
      ? business.website 
      : `https://${business.website}`;

    // Create audit record
    const { data: audit, error: auditError } = await supabase
      .from('site_audits')
      .insert({
        business_id: businessId,
        website_url: websiteUrl,
        status: 'RUNNING',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (auditError) {
      throw new Error(`Failed to create audit: ${auditError.message}`);
    }

    // Audit main page
    const pageResults: PageResult[] = [];
    
    const mainPage = await auditPage(websiteUrl);
    if (mainPage) {
      const result = analyzeHTML(mainPage.html, websiteUrl);
      pageResults.push(result);
    }

    // Try common pages
    const commonPaths = ['/about', '/about-us', '/services', '/contact', '/faq'];
    
    for (const path of commonPaths) {
      const pageUrl = new URL(path, websiteUrl).href;
      const page = await auditPage(pageUrl);
      if (page) {
        const result = analyzeHTML(page.html, pageUrl);
        pageResults.push(result);
      }
      // Small delay
      await new Promise(r => setTimeout(r, 500));
    }

    // Generate issues
    const { critical, warnings, passed } = generateAuditIssues(pageResults, websiteUrl);

    // Calculate scores
    const avgPageScore = pageResults.length > 0
      ? pageResults.reduce((sum, p) => sum + p.score, 0) / pageResults.length
      : 0;

    const schemaScore = pageResults.some(p => p.hasSchema) ? 70 : 20;
    const contentScore = Math.round(avgPageScore);
    const technicalScore = 100 - (critical.length * 20) - (warnings.length * 10);
    const crawlabilityScore = pageResults.length > 0 ? 80 : 20;
    
    const overallScore = Math.round(
      (schemaScore * 0.3) +
      (contentScore * 0.3) +
      (Math.max(0, technicalScore) * 0.2) +
      (crawlabilityScore * 0.2)
    );

    // Collect schema types
    const allSchemaTypes = [...new Set(pageResults.flatMap(p => p.schemaTypes))];
    
    const recommendedSchema = ['Organization', 'LocalBusiness', 'WebSite', 'FAQPage'];
    const missingSchema = recommendedSchema.filter(s => 
      !allSchemaTypes.some(t => t.toLowerCase().includes(s.toLowerCase()))
    );

    // Update audit
    await supabase
      .from('site_audits')
      .update({
        status: 'COMPLETED',
        overall_score: overallScore,
        technical_score: Math.max(0, technicalScore),
        content_score: contentScore,
        schema_score: schemaScore,
        crawlability_score: crawlabilityScore,
        critical_issues: critical,
        warnings,
        passed_checks: passed,
        pages_analyzed: pageResults.length,
        page_results: pageResults,
        schema_types: allSchemaTypes,
        missing_schema: missingSchema,
        completed_at: new Date().toISOString(),
      })
      .eq('id', audit.id);

    // Create alert if critical issues
    if (critical.length > 0) {
      await supabase.from('alerts').insert({
        user_id: business.user_id,
        business_id: businessId,
        alert_type: 'AUDIT_CRITICAL',
        severity: 'WARNING',
        title: `${critical.length} Critical Issue(s) Found`,
        message: `Site audit found critical issues affecting AI visibility.`,
        data: { criticalCount: critical.length, warningCount: warnings.length },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        auditId: audit.id,
        scores: {
          overall: overallScore,
          technical: Math.max(0, technicalScore),
          content: contentScore,
          schema: schemaScore,
          crawlability: crawlabilityScore,
        },
        pagesAnalyzed: pageResults.length,
        criticalIssues: critical.length,
        warnings: warnings.length,
        passedChecks: passed.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Site Audit Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
