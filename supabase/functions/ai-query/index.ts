/**
 * AI Query Edge Function
 * 
 * Queries AI platforms (ChatGPT, Claude, Perplexity, Gemini) with prompts
 * and returns raw responses for analysis.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryRequest {
  platform: 'chatgpt' | 'claude' | 'perplexity' | 'gemini' | 'google_ai';
  prompt: string;
  businessName?: string;
  model?: string;
}

interface QueryResponse {
  platform: string;
  prompt: string;
  response: string;
  model: string;
  responseTimeMs: number;
  tokenCount?: number;
  error?: string;
}

// Query ChatGPT (OpenAI)
async function queryChatGPT(prompt: string, model: string = 'gpt-4-turbo-preview'): Promise<{ response: string; tokenCount?: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant providing information about businesses, products, and services. Be honest, balanced, and informative in your responses. If you don\'t have specific information about something, say so.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await res.json();
  return {
    response: data.choices[0]?.message?.content || '',
    tokenCount: data.usage?.total_tokens,
  };
}

// Query Claude (Anthropic)
async function queryClaude(prompt: string, model: string = 'claude-3-sonnet-20240229'): Promise<{ response: string; tokenCount?: number }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((block: any) => block.type === 'text');
  return {
    response: textBlock?.text || '',
    tokenCount: data.usage?.input_tokens + data.usage?.output_tokens,
  };
}

// Query Perplexity
async function queryPerplexity(prompt: string, model: string = 'llama-3.1-sonar-large-128k-online'): Promise<{ response: string }> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY not configured');

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Be precise and informative. Provide balanced information about businesses when asked.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Perplexity API error: ${error}`);
  }

  const data = await res.json();
  return {
    response: data.choices[0]?.message?.content || '',
  };
}

// Query Gemini (Google AI)
async function queryGemini(prompt: string, model: string = 'gemini-pro'): Promise<{ response: string }> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await res.json();
  return {
    response: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, prompt, model }: QueryRequest = await req.json();

    if (!platform || !prompt) {
      return new Response(
        JSON.stringify({ error: 'platform and prompt are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    let result: { response: string; tokenCount?: number };
    let modelUsed = model || '';

    switch (platform) {
      case 'chatgpt':
        modelUsed = model || 'gpt-4-turbo-preview';
        result = await queryChatGPT(prompt, modelUsed);
        break;

      case 'claude':
        modelUsed = model || 'claude-3-sonnet-20240229';
        result = await queryClaude(prompt, modelUsed);
        break;

      case 'perplexity':
        modelUsed = model || 'llama-3.1-sonar-large-128k-online';
        result = await queryPerplexity(prompt, modelUsed);
        break;

      case 'gemini':
      case 'google_ai':
        modelUsed = model || 'gemini-pro';
        result = await queryGemini(prompt, modelUsed);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported platform: ${platform}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const responseTimeMs = Date.now() - startTime;

    const response: QueryResponse = {
      platform,
      prompt,
      response: result.response,
      model: modelUsed,
      responseTimeMs,
      tokenCount: result.tokenCount,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Query Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
