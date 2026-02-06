/**
 * Email Reports Edge Function
 * 
 * Handles:
 * - Report scheduling logic
 * - Email payload creation
 * - Queue management
 * - Handoff to Lovable's email service
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// REPORT TEMPLATES
// ===========================================

const REPORT_TEMPLATES = {
  visibility_summary: {
    subject: 'AI Visibility Report - {business_name}',
    sections: ['scores', 'visibility_trend', 'top_mentions', 'recommendations'],
  },
  prompt_performance: {
    subject: 'Prompt Performance Report - {business_name}',
    sections: ['prompt_stats', 'mention_rates', 'platform_breakdown'],
  },
  competitive_analysis: {
    subject: 'Competitive Analysis - {business_name}',
    sections: ['benchmarks', 'share_of_voice', 'competitor_insights'],
  },
  executive_briefing: {
    subject: 'Executive Briefing - AI Visibility Status',
    sections: ['summary', 'key_metrics', 'changes', 'action_items'],
  },
  trust_recommendation_audit: {
    subject: 'Trust & Recommendation Audit - {business_name}',
    sections: ['trust_score', 'recommendation_rate', 'sentiment', 'risk_flags'],
  },
  local_readiness: {
    subject: 'Local AI Readiness Report - {business_name}',
    sections: ['local_visibility', 'nap_consistency', 'local_competitors'],
  },
  weekly_digest: {
    subject: 'Weekly AI Visibility Digest - {business_name}',
    sections: ['score_changes', 'new_mentions', 'alerts', 'next_steps'],
  },
};

// ===========================================
// EMAIL HTML GENERATOR
// ===========================================

function generateEmailHTML(
  reportType: string,
  business: any,
  data: any,
  branding?: { companyName?: string; primaryColor?: string; logoUrl?: string }
): string {
  const brandName = branding?.companyName || 'Trustable';
  const primaryColor = branding?.primaryColor || '#3B82F6';
  
  const scoreColor = (score: number) => 
    score >= 70 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportType.replace(/_/g, ' ').toUpperCase()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid ${primaryColor}; }
    .logo { max-height: 40px; }
    .score-card { background: #F9FAFB; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .score { font-size: 48px; font-weight: bold; }
    .score-label { color: #6B7280; font-size: 14px; }
    .section { margin: 30px 0; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: ${primaryColor}; }
    .metric-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E5E7EB; }
    .metric-label { color: #6B7280; }
    .metric-value { font-weight: 600; }
    .change-positive { color: #22C55E; }
    .change-negative { color: #EF4444; }
    .cta-button { display: inline-block; background: ${primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; padding: 30px 0; color: #9CA3AF; font-size: 12px; }
    .disclaimer { background: #FEF3C7; padding: 15px; border-radius: 6px; font-size: 13px; color: #92400E; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${branding?.logoUrl ? `<img src="${branding.logoUrl}" class="logo" alt="${brandName}">` : `<h1>${brandName}</h1>`}
    </div>
    
    <h2 style="text-align: center; margin-top: 30px;">${business.name}</h2>
    <p style="text-align: center; color: #6B7280;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    
    ${data.scores ? `
    <div class="score-card" style="text-align: center;">
      <div class="score" style="color: ${scoreColor(data.scores.overall_score)}">${data.scores.overall_score}</div>
      <div class="score-label">Overall AI Readiness Score</div>
      ${data.scoreChange ? `
        <div style="margin-top: 10px; color: ${data.scoreChange >= 0 ? '#22C55E' : '#EF4444'}">
          ${data.scoreChange >= 0 ? '↑' : '↓'} ${Math.abs(data.scoreChange)} points from last period
        </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${data.metrics ? `
    <div class="section">
      <div class="section-title">Key Metrics</div>
      ${Object.entries(data.metrics).map(([key, value]) => `
        <div class="metric-row">
          <span class="metric-label">${key.replace(/_/g, ' ')}</span>
          <span class="metric-value">${value}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${data.insights && data.insights.length > 0 ? `
    <div class="section">
      <div class="section-title">Key Insights</div>
      <ul>
        ${data.insights.map((i: string) => `<li>${i}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${data.recommendations && data.recommendations.length > 0 ? `
    <div class="section">
      <div class="section-title">Recommended Actions</div>
      <ol>
        ${data.recommendations.map((r: any) => `
          <li style="margin-bottom: 10px;">
            <strong>${r.title || r}</strong>
            ${r.description ? `<p style="margin: 5px 0 0; color: #6B7280; font-size: 14px;">${r.description}</p>` : ''}
          </li>
        `).join('')}
      </ol>
    </div>
    ` : ''}
    
    <div style="text-align: center;">
      <a href="https://app.trustable.ai/dashboard" class="cta-button">View Full Dashboard</a>
    </div>
    
    <div class="disclaimer">
      <strong>Disclaimer:</strong> AI visibility metrics are observational and do not guarantee specific rankings or outcomes. AI system behaviors change frequently and results may vary.
    </div>
    
    <div class="footer">
      <p>Powered by ${brandName}</p>
      <p>You received this email because you subscribed to ${reportType.replace(/_/g, ' ')} reports.</p>
      <p><a href="https://app.trustable.ai/settings/notifications">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>`;
}

function generateTextVersion(reportType: string, business: any, data: any): string {
  let text = `${reportType.replace(/_/g, ' ').toUpperCase()}\n`;
  text += `${business.name}\n`;
  text += `Generated: ${new Date().toLocaleDateString()}\n\n`;
  
  if (data.scores) {
    text += `OVERALL SCORE: ${data.scores.overall_score}/100\n`;
    if (data.scoreChange) {
      text += `Change: ${data.scoreChange >= 0 ? '+' : ''}${data.scoreChange} points\n`;
    }
    text += '\n';
  }
  
  if (data.metrics) {
    text += 'KEY METRICS:\n';
    Object.entries(data.metrics).forEach(([key, value]) => {
      text += `  ${key.replace(/_/g, ' ')}: ${value}\n`;
    });
    text += '\n';
  }
  
  if (data.recommendations?.length > 0) {
    text += 'RECOMMENDED ACTIONS:\n';
    data.recommendations.forEach((r: any, i: number) => {
      text += `  ${i + 1}. ${r.title || r}\n`;
    });
    text += '\n';
  }
  
  text += 'DISCLAIMER: AI visibility metrics are observational and do not guarantee specific rankings or outcomes.\n\n';
  text += 'View dashboard: https://app.trustable.ai/dashboard\n';
  
  return text;
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

    const { action } = await req.json();

    // ===========================================
    // CREATE EMAIL PAYLOAD
    // ===========================================
    if (action === 'create_email') {
      const { reportDefinitionId, recipientEmail, recipientName } = await req.json();

      // Get report definition
      const { data: reportDef, error: defError } = await supabase
        .from('report_definitions')
        .select('*')
        .eq('id', reportDefinitionId)
        .single();

      if (defError || !reportDef) {
        return new Response(
          JSON.stringify({ error: 'Report definition not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get business
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', reportDef.business_id)
        .single();

      // Get report data
      const reportData = await getReportData(supabase, reportDef.business_id, reportDef.report_type);

      // Get branding
      const branding = reportDef.white_label ? reportDef.custom_branding : undefined;

      // Generate subject
      const template = REPORT_TEMPLATES[reportDef.report_type as keyof typeof REPORT_TEMPLATES];
      const subject = (template?.subject || 'AI Visibility Report - {business_name}')
        .replace('{business_name}', business?.name || 'Your Business');

      // Generate HTML and text
      const htmlBody = generateEmailHTML(reportDef.report_type, business, reportData, branding);
      const textBody = generateTextVersion(reportDef.report_type, business, reportData);

      // Queue email
      const { data: email, error: queueError } = await supabase
        .from('email_queue')
        .insert({
          to_email: recipientEmail,
          to_name: recipientName,
          subject,
          html_body: htmlBody,
          text_body: textBody,
          email_type: 'report',
          related_id: reportDefinitionId,
          status: 'queued',
        })
        .select()
        .single();

      if (queueError) throw queueError;

      return new Response(
        JSON.stringify({
          success: true,
          emailId: email.id,
          status: 'queued',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // GET QUEUED EMAILS (For Lovable to process)
    // ===========================================
    if (action === 'get_queued') {
      const { limit = 10 } = await req.json();

      const { data: emails, error } = await supabase
        .from('email_queue')
        .select('*')
        .eq('status', 'queued')
        .order('scheduled_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          emails: emails.map(e => ({
            id: e.id,
            to: e.to_email,
            toName: e.to_name,
            from: e.from_email,
            fromName: e.from_name,
            replyTo: e.reply_to,
            subject: e.subject,
            html: e.html_body,
            text: e.text_body,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // MARK EMAIL SENT (Called by Lovable after sending)
    // ===========================================
    if (action === 'mark_sent') {
      const { emailId, externalId, provider } = await req.json();

      await supabase
        .from('email_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          external_id: externalId,
          provider,
        })
        .eq('id', emailId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // MARK EMAIL FAILED
    // ===========================================
    if (action === 'mark_failed') {
      const { emailId, error, errorCode } = await req.json();

      const { data: email } = await supabase
        .from('email_queue')
        .select('attempts, max_attempts')
        .eq('id', emailId)
        .single();

      const newAttempts = (email?.attempts || 0) + 1;
      const status = newAttempts >= (email?.max_attempts || 3) ? 'failed' : 'queued';

      await supabase
        .from('email_queue')
        .update({
          status,
          attempts: newAttempts,
          last_error: error,
          error_code: errorCode,
        })
        .eq('id', emailId);

      return new Response(
        JSON.stringify({ success: true, willRetry: status === 'queued' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // PROCESS SCHEDULED REPORTS
    // ===========================================
    if (action === 'process_scheduled') {
      const now = new Date();

      // Find reports due to run
      const { data: dueReports } = await supabase
        .from('report_definitions')
        .select('*')
        .eq('is_active', true)
        .lte('next_run_at', now.toISOString());

      if (!dueReports || dueReports.length === 0) {
        return new Response(
          JSON.stringify({ success: true, processed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let processed = 0;

      for (const report of dueReports) {
        // Create emails for all recipients
        for (const recipient of report.email_recipients || []) {
          await supabase.functions.invoke('email-reports', {
            body: {
              action: 'create_email',
              reportDefinitionId: report.id,
              recipientEmail: recipient,
            },
          });
        }

        // Calculate next run
        let nextRun: Date;
        switch (report.schedule) {
          case 'DAILY':
            nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case 'WEEKLY':
            nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'MONTHLY':
            nextRun = new Date(now.getFullYear(), now.getMonth() + 1, report.schedule_day || 1);
            break;
          default:
            nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        await supabase
          .from('report_definitions')
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
          })
          .eq('id', report.id);

        processed++;
      }

      return new Response(
        JSON.stringify({ success: true, processed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Email Reports Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ===========================================
// HELPER: Get Report Data
// ===========================================

async function getReportData(supabase: any, businessId: string, reportType: string) {
  const data: any = {};

  // Get scores
  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(2);

  if (scores && scores.length > 0) {
    data.scores = scores[0];
    if (scores.length > 1) {
      data.scoreChange = scores[0].overall_score - scores[1].overall_score;
    }
  }

  // Get recommendations
  const { data: recs } = await supabase
    .from('recommendations')
    .select('title, description, priority')
    .eq('business_id', businessId)
    .eq('status', 'PENDING')
    .order('priority')
    .limit(3);

  data.recommendations = recs || [];

  // Get metrics based on report type
  if (reportType === 'visibility_summary' || reportType === 'executive_briefing') {
    data.metrics = {
      'AI Trust Score': scores?.[0]?.ai_trust_score || 'N/A',
      'AI Visibility': scores?.[0]?.ai_visibility_score || 'N/A',
      'Recommendation Rate': scores?.[0]?.ai_recommendation_score || 'N/A',
      'Sentiment Score': scores?.[0]?.sentiment_score || 'N/A',
    };
  }

  // Get insights
  const insights: string[] = [];
  if (scores?.[0]) {
    if (scores[0].ai_visibility_score >= 70) {
      insights.push('Strong AI visibility - your brand is frequently mentioned');
    } else if (scores[0].ai_visibility_score < 40) {
      insights.push('Low AI visibility - AI systems rarely mention your brand');
    }
    if (scores[0].ai_trust_score >= 70) {
      insights.push('High trust signals detected in AI responses');
    }
  }
  data.insights = insights;

  return data;
}
