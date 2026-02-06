/**
 * Agent Chat Edge Function
 * 
 * Handles conversational AI interactions:
 * - Create/retrieve threads
 * - Send messages
 * - Execute tools with audit logging
 * - Stream responses via chunked polling
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// SYSTEM PROMPT
// ===========================================

const SYSTEM_PROMPT = `You are Trustable AI, an expert assistant helping businesses improve their visibility and trustworthiness in AI systems like ChatGPT, Claude, and Perplexity.

## Your Capabilities
You can:
- Explain visibility scores and what they mean
- Summarize audit findings and prioritize fixes
- Create prompts to track visibility
- Generate AI-optimized content
- Analyze competitor visibility
- Create action plans with specific next steps
- Generate reports on visibility trends

## CRITICAL SAFETY RULES - You MUST follow these:

1. NEVER claim you can guarantee rankings or visibility
   - ❌ "This will make you rank #1"
   - ✅ "This may help improve your visibility over time"

2. NEVER make absolute promises about AI behavior
   - ❌ "ChatGPT will definitely recommend you"
   - ✅ "This improves signals that AI systems look for"

3. ALWAYS include appropriate disclaimers:
   - "AI behavior is probabilistic and changes frequently"
   - "Results vary and are not guaranteed"
   - "Improving visibility takes time and consistent effort"

4. NEVER use manipulative or black-hat tactics

5. Be honest about limitations - if you don't know, say so

## Response Style
- Be helpful, clear, and actionable
- Provide specific examples and next steps
- Reference actual data from the workspace
- Keep responses focused`;

// ===========================================
// TOOL DEFINITIONS
// ===========================================

interface Tool {
  name: string;
  description: string;
  parameters: object;
  requiresApproval: boolean;
  minPlan: string;
}

const TOOLS: Tool[] = [
  {
    name: 'get_visibility_summary',
    description: 'Get a summary of current AI visibility metrics for the business',
    parameters: { type: 'object', properties: {}, required: [] },
    requiresApproval: false,
    minPlan: 'FREE',
  },
  {
    name: 'explain_score',
    description: 'Explain what a specific score means and its key drivers',
    parameters: {
      type: 'object',
      properties: {
        score_type: { type: 'string', description: 'Score to explain: ai_trust, ai_visibility, ai_recommendation, sentiment, overall' },
      },
      required: ['score_type'],
    },
    requiresApproval: false,
    minPlan: 'FREE',
  },
  {
    name: 'get_recommendations',
    description: 'Get prioritized action recommendations',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max recommendations to return' },
      },
      required: [],
    },
    requiresApproval: false,
    minPlan: 'FREE',
  },
  {
    name: 'get_audit_issues',
    description: 'Get website audit issues sorted by severity',
    parameters: {
      type: 'object',
      properties: {
        severity: { type: 'string', description: 'Filter by severity' },
      },
      required: [],
    },
    requiresApproval: false,
    minPlan: 'FREE',
  },
  {
    name: 'get_competitor_analysis',
    description: 'Get competitor benchmarking data',
    parameters: { type: 'object', properties: {}, required: [] },
    requiresApproval: false,
    minPlan: 'STARTER',
  },
  {
    name: 'propose_actions',
    description: 'Generate specific next actions with wording suggestions',
    parameters: {
      type: 'object',
      properties: {
        focus_area: { type: 'string', description: 'Area to focus on' },
      },
      required: [],
    },
    requiresApproval: false,
    minPlan: 'STARTER',
  },
  {
    name: 'create_prompt',
    description: 'Create a new tracking prompt',
    parameters: {
      type: 'object',
      properties: {
        prompt_text: { type: 'string', description: 'The prompt to track' },
        query_type: { type: 'string', description: 'Type of query' },
      },
      required: ['prompt_text', 'query_type'],
    },
    requiresApproval: true,
    minPlan: 'STARTER',
  },
  {
    name: 'generate_content_brief',
    description: 'Generate a content brief for AI-optimized content',
    parameters: {
      type: 'object',
      properties: {
        content_type: { type: 'string', description: 'Type of content' },
        topic: { type: 'string', description: 'Topic or focus' },
      },
      required: ['content_type'],
    },
    requiresApproval: true,
    minPlan: 'STARTER',
  },
  {
    name: 'generate_report_payload',
    description: 'Generate a report payload for visibility or executive summary',
    parameters: {
      type: 'object',
      properties: {
        report_type: { type: 'string', description: 'Type of report' },
      },
      required: ['report_type'],
    },
    requiresApproval: true,
    minPlan: 'PROFESSIONAL',
  },
];

// ===========================================
// TOOL EXECUTION
// ===========================================

async function executeTool(
  supabase: any,
  businessId: string,
  toolName: string,
  params: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    switch (toolName) {
      case 'get_visibility_summary': {
        const { data: scores } = await supabase
          .from('scores')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        const { data: sov } = await supabase
          .from('share_of_voice')
          .select('*')
          .eq('business_id', businessId)
          .order('period', { ascending: false })
          .limit(1)
          .single();
        
        return {
          success: true,
          data: {
            scores: scores ? {
              overall: scores.overall_score,
              ai_trust: scores.ai_trust_score,
              ai_visibility: scores.ai_visibility_score,
              ai_recommendation: scores.ai_recommendation_score,
              sentiment: scores.sentiment_score,
            } : null,
            share_of_voice: sov?.share_of_voice,
            message: scores 
              ? `Your overall AI readiness score is ${scores.overall_score}/100.`
              : 'No visibility data yet. Run a scan first.',
          },
        };
      }
      
      case 'explain_score': {
        const { data: scores } = await supabase
          .from('scores')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!scores) {
          return { success: true, data: { message: 'No scores available yet.' } };
        }
        
        const scoreType = params.score_type || 'overall';
        const scoreValue = scores[`${scoreType}_score`] || scores.overall_score;
        
        const explanations: Record<string, string> = {
          ai_trust: 'AI Trust measures how confidently AI describes your brand. It considers sentiment, hedging language, and recommendation signals.',
          ai_visibility: 'AI Visibility measures how often AI mentions your brand. Higher visibility means more frequent mentions across platforms.',
          ai_recommendation: 'AI Recommendation measures how often AI actively suggests your brand to users asking for options.',
          sentiment: 'Sentiment measures the overall positivity of how AI describes your brand.',
          overall: 'Overall AI Readiness is a composite score weighing trust, visibility, recommendations, and sentiment.',
        };
        
        return {
          success: true,
          data: {
            score_type: scoreType,
            value: scoreValue,
            grade: scoreValue >= 80 ? 'A' : scoreValue >= 60 ? 'B' : scoreValue >= 40 ? 'C' : 'D',
            explanation: explanations[scoreType] || explanations.overall,
          },
        };
      }
      
      case 'get_recommendations': {
        const { data: recs } = await supabase
          .from('recommendations')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'PENDING')
          .order('priority')
          .limit(params.limit || 5);
        
        return {
          success: true,
          data: {
            count: recs?.length || 0,
            recommendations: recs?.map((r: any) => ({
              priority: r.priority,
              title: r.title,
              category: r.category,
              estimated_impact: r.estimated_impact,
            })),
          },
        };
      }
      
      case 'get_audit_issues': {
        const { data: audit } = await supabase
          .from('site_audits')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'COMPLETED')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!audit) {
          return { success: true, data: { message: 'No audit data. Run a site audit first.' } };
        }
        
        return {
          success: true,
          data: {
            overall_score: audit.overall_score,
            critical_count: audit.critical_issues?.length || 0,
            warning_count: audit.warnings?.length || 0,
            issues: audit.critical_issues?.slice(0, 5),
          },
        };
      }
      
      case 'get_competitor_analysis': {
        const { data: benchmarks } = await supabase
          .from('competitor_benchmarks')
          .select('*')
          .eq('business_id', businessId);
        
        return {
          success: true,
          data: {
            competitors_tracked: benchmarks?.length || 0,
            benchmarks: benchmarks?.map((b: any) => ({
              name: b.competitor_name,
              visibility_diff: b.visibility_diff,
              insights: b.insights,
            })),
          },
        };
      }
      
      case 'propose_actions': {
        // Get current state
        const { data: scores } = await supabase
          .from('scores')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        const actions = [];
        
        if (scores) {
          if (scores.ai_visibility_score < 50) {
            actions.push({
              priority: 'HIGH',
              action: 'Create comprehensive About page content',
              wording: 'Write a detailed About page (800+ words) that clearly explains who you are, what you do, and why customers choose you.',
            });
          }
          if (scores.ai_trust_score < 50) {
            actions.push({
              priority: 'HIGH',
              action: 'Add trust signals to your website',
              wording: 'Add credentials, certifications, case studies, and customer testimonials to build authority.',
            });
          }
          if (scores.ai_recommendation_score < 40) {
            actions.push({
              priority: 'MEDIUM',
              action: 'Create comparison content',
              wording: 'Write "Why choose us" content that highlights your unique value proposition.',
            });
          }
        }
        
        return { success: true, data: { actions } };
      }
      
      case 'create_prompt': {
        const { error } = await supabase
          .from('tracked_prompts')
          .insert({
            business_id: businessId,
            prompt: params.prompt_text,
            query_type: params.query_type || 'BRAND_DIRECT',
            priority: 'MEDIUM',
            is_active: true,
          });
        
        if (error) throw error;
        
        return {
          success: true,
          data: { message: `Created tracking prompt: "${params.prompt_text}"` },
        };
      }
      
      case 'generate_content_brief': {
        // Would call generate-content function
        return {
          success: true,
          data: {
            content_type: params.content_type,
            brief: `Generate a ${params.content_type} about ${params.topic || 'your business'}. Focus on being comprehensive, factual, and AI-citation-friendly.`,
            next_step: 'Use the content generator to create the full content.',
          },
        };
      }
      
      case 'generate_report_payload': {
        // Would call export-report function
        return {
          success: true,
          data: {
            report_type: params.report_type,
            message: `Report payload for ${params.report_type} is ready. Use the export function to generate.`,
          },
        };
      }
      
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===========================================
// PLAN CHECKING
// ===========================================

const PLAN_ORDER = ['FREE', 'STARTER', 'PROFESSIONAL', 'SCALE', 'CUSTOM'];

function planMeetsMinimum(userPlan: string, minPlan: string): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(minPlan);
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
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, threadId, businessId, message, userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check plan allows agent
    if (profile.plan === 'FREE') {
      return new Response(
        JSON.stringify({ error: 'Agent chat requires Starter plan or higher' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // ACTION: LIST TOOLS
    // ===========================================
    if (action === 'list_tools') {
      const availableTools = TOOLS.filter(t => planMeetsMinimum(profile.plan, t.minPlan));
      const lockedTools = TOOLS.filter(t => !planMeetsMinimum(profile.plan, t.minPlan));

      return new Response(
        JSON.stringify({
          success: true,
          plan: profile.plan,
          available: availableTools.map(t => ({
            name: t.name,
            description: t.description,
            category: t.name.startsWith('get_') ? 'read' : 
                      t.name.startsWith('generate_') ? 'generate' :
                      t.name.startsWith('create_') ? 'write' : 'analyze',
            requiresApproval: t.requiresApproval,
          })),
          locked: lockedTools.map(t => ({
            name: t.name,
            description: t.description,
            requiresPlan: t.minPlan,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // ACTION: CREATE THREAD
    // ===========================================
    if (action === 'create_thread') {
      const { data: thread, error } = await supabase
        .from('agent_threads')
        .insert({
          user_id: userId,
          business_id: businessId,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, thread }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // ACTION: GET HISTORY
    // ===========================================
    if (action === 'get_history') {
      const { data: messages, error } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, messages }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // ACTION: SEND MESSAGE
    // ===========================================
    if (action === 'send_message') {
      if (!threadId || !message) {
        return new Response(
          JSON.stringify({ error: 'threadId and message are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check usage limit
      const { data: usageCheck } = await supabase.rpc('check_agent_usage', {
        p_user_id: userId,
      });

      if (usageCheck && !usageCheck[0]?.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Daily message limit reached',
            usage: usageCheck[0],
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store user message
      await supabase.from('agent_messages').insert({
        thread_id: threadId,
        role: 'user',
        content: message,
      });

      // Get conversation history
      const { data: history } = await supabase
        .from('agent_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(20);

      // Build messages for OpenAI
      const messages_for_api = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(history || []).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      ];

      // Get available tools for this plan
      const availableTools = TOOLS.filter(t => 
        planMeetsMinimum(profile.plan, t.minPlan)
      );

      // Call OpenAI
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: messages_for_api,
          tools: availableTools.map(t => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
          tool_choice: 'auto',
        }),
      });

      if (!openaiRes.ok) {
        throw new Error(`OpenAI API error: ${await openaiRes.text()}`);
      }

      const openaiData = await openaiRes.json();
      const choice = openaiData.choices[0];
      const assistantMessage = choice.message;

      // Handle tool calls
      let toolResults: any[] = [];
      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolParams = JSON.parse(toolCall.function.arguments);
          const tool = TOOLS.find(t => t.name === toolName);

          // Check if tool requires approval
          if (tool?.requiresApproval) {
            // Log as pending
            await supabase.from('agent_tool_audit').insert({
              thread_id: threadId,
              user_id: userId,
              tool_name: toolName,
              tool_input: toolParams,
              status: 'pending_approval',
            });

            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify({
                pending: true,
                message: `This action requires your approval. Would you like me to ${toolName.replace(/_/g, ' ')}?`,
              }),
            });
          } else {
            // Execute tool
            const startTime = Date.now();
            const result = await executeTool(supabase, businessId, toolName, toolParams);
            const execTime = Date.now() - startTime;

            // Log execution
            await supabase.from('agent_tool_audit').insert({
              thread_id: threadId,
              user_id: userId,
              tool_name: toolName,
              tool_input: toolParams,
              tool_output: result.data,
              status: result.success ? 'executed' : 'error',
              error_message: result.error,
              execution_time_ms: execTime,
            });

            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(result.data || { error: result.error }),
            });
          }
        }

        // If there were tool calls, get a follow-up response
        if (toolResults.length > 0) {
          const followUpRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4-turbo-preview',
              messages: [
                ...messages_for_api,
                assistantMessage,
                ...toolResults,
              ],
            }),
          });

          const followUpData = await followUpRes.json();
          const finalContent = followUpData.choices[0].message.content;

          // Store assistant response
          const { data: savedMessage } = await supabase
            .from('agent_messages')
            .insert({
              thread_id: threadId,
              role: 'assistant',
              content: finalContent,
              tool_calls: assistantMessage.tool_calls,
              model_used: 'gpt-4-turbo-preview',
              tokens_used: openaiData.usage?.total_tokens,
            })
            .select()
            .single();

          return new Response(
            JSON.stringify({
              success: true,
              message: savedMessage,
              toolsExecuted: toolResults.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // No tool calls - just store the response
      const { data: savedMessage } = await supabase
        .from('agent_messages')
        .insert({
          thread_id: threadId,
          role: 'assistant',
          content: assistantMessage.content,
          model_used: 'gpt-4-turbo-preview',
          tokens_used: openaiData.usage?.total_tokens,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, message: savedMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // ACTION: APPROVE TOOL
    // ===========================================
    if (action === 'approve_tool') {
      const { toolAuditId } = await req.json();

      const { data: audit } = await supabase
        .from('agent_tool_audit')
        .select('*')
        .eq('id', toolAuditId)
        .single();

      if (!audit || audit.status !== 'pending_approval') {
        return new Response(
          JSON.stringify({ error: 'Tool not found or already processed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Execute the tool
      const result = await executeTool(supabase, businessId, audit.tool_name, audit.tool_input);

      // Update audit
      await supabase
        .from('agent_tool_audit')
        .update({
          status: result.success ? 'executed' : 'error',
          tool_output: result.data,
          error_message: result.error,
        })
        .eq('id', toolAuditId);

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Agent Chat Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
