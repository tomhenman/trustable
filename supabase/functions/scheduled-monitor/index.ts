/**
 * Scheduled Monitor Edge Function
 * 
 * Called by cron to run scheduled scans for all active businesses.
 * This is the "always-on monitoring" that makes it like Searchable.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the frequency from request (daily, weekly) or default to daily
    const { frequency = 'daily' } = await req.json().catch(() => ({}));

    console.log(`Running scheduled monitor for frequency: ${frequency}`);

    // Get all businesses due for scanning
    const now = new Date();
    const cutoffDate = new Date();
    
    if (frequency === 'daily') {
      cutoffDate.setHours(cutoffDate.getHours() - 23); // Run if not scanned in 23 hours
    } else if (frequency === 'weekly') {
      cutoffDate.setDate(cutoffDate.getDate() - 6); // Run if not scanned in 6 days
    }

    // Find businesses that need scanning
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        user_id,
        monitoring_frequency,
        monitoring_enabled,
        user_profiles!inner(plan)
      `)
      .eq('monitoring_enabled', true)
      .eq('monitoring_frequency', frequency);

    if (bizError) {
      throw new Error(`Failed to fetch businesses: ${bizError.message}`);
    }

    if (!businesses || businesses.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No businesses to scan', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${businesses.length} businesses for ${frequency} monitoring`);

    // Check which ones haven't been scanned recently
    const businessesToScan: any[] = [];

    for (const business of businesses) {
      // Check last scan
      const { data: lastScan } = await supabase
        .from('scans')
        .select('created_at')
        .eq('business_id', business.id)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lastScanDate = lastScan?.created_at ? new Date(lastScan.created_at) : null;
      
      if (!lastScanDate || lastScanDate < cutoffDate) {
        businessesToScan.push(business);
      }
    }

    console.log(`${businessesToScan.length} businesses need scanning`);

    // Determine platforms based on plan
    const getPlatformsForPlan = (plan: string): string[] => {
      switch (plan) {
        case 'FREE':
          return ['chatgpt'];
        case 'STARTER':
          return ['chatgpt'];
        case 'PROFESSIONAL':
          return ['chatgpt', 'claude', 'perplexity'];
        case 'SCALE':
        case 'CUSTOM':
          return ['chatgpt', 'claude', 'perplexity', 'gemini'];
        default:
          return ['chatgpt'];
      }
    };

    // Run scans
    const results: any[] = [];
    const scanUrl = `${supabaseUrl}/functions/v1/run-scan`;

    for (const business of businessesToScan.slice(0, 50)) { // Limit to 50 per run
      try {
        const platforms = getPlatformsForPlan(business.user_profiles?.plan || 'FREE');
        
        console.log(`Scanning ${business.name} (${business.id}) with platforms: ${platforms.join(', ')}`);

        const scanRes = await fetch(scanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            businessId: business.id,
            scanType: 'SCHEDULED',
            platforms,
          }),
        });

        const scanResult = await scanRes.json();
        
        results.push({
          businessId: business.id,
          businessName: business.name,
          success: scanRes.ok,
          scores: scanResult.scores,
          error: scanResult.error,
        });

        // Delay between scans to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        console.error(`Failed to scan ${business.name}:`, err);
        results.push({
          businessId: business.id,
          businessName: business.name,
          success: false,
          error: err.message,
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Scheduled monitor complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        message: 'Scheduled monitoring complete',
        frequency,
        totalBusinesses: businesses.length,
        scanned: results.length,
        successful,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduled Monitor Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
