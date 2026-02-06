/**
 * Generate Content Edge Function
 * 
 * Uses AI (GPT-4) to generate optimized content:
 * - About pages
 * - FAQ pages  
 * - Service pages
 * - Blog posts
 * - TikTok scripts
 * - Review request emails
 * - Case studies
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ContentType = 
  | 'ABOUT_PAGE' 
  | 'FAQ_PAGE' 
  | 'SERVICE_PAGE' 
  | 'BLOG_POST'
  | 'TIKTOK_SCRIPT'
  | 'REVIEW_REQUEST'
  | 'CASE_STUDY'
  | 'META_DESCRIPTION';

interface GenerateRequest {
  businessId: string;
  contentType: ContentType;
  additionalContext?: string;
  serviceName?: string;  // For service pages
  topic?: string;        // For blog posts
}

// ===========================================
// CONTENT PROMPTS
// ===========================================

function getSystemPrompt(): string {
  return `You are an expert content writer specializing in creating content optimized for AI discovery and citation. 

Your content should:
- Be factual, specific, and verifiable
- Include concrete details (numbers, dates, specifics)
- Be well-structured with clear headers and sections
- Answer questions that AI systems commonly receive
- Be written in a confident, authoritative tone
- Avoid vague or hedging language
- Include relevant keywords naturally
- Be comprehensive enough to be cited as a source

Write content that makes it easy for AI systems like ChatGPT and Claude to understand, trust, and recommend the business.`;
}

function getContentPrompt(type: ContentType, business: any, extra?: any): string {
  const name = business.name;
  const category = business.category || '[category]';
  const location = business.city ? `${business.city}${business.country ? ', ' + business.country : ''}` : '';
  const description = business.description || '';
  const services = business.services?.join(', ') || '';
  const founded = business.founded_year || '';
  const phone = business.phone || '';
  const email = business.email || '';
  const website = business.website || '';

  switch (type) {
    case 'ABOUT_PAGE':
      return `Write a comprehensive About page for ${name}, a ${category} business${location ? ` based in ${location}` : ''}.

Business details:
- Description: ${description || 'A professional ' + category + ' company'}
- Services: ${services || 'Various ' + category + ' services'}
- Founded: ${founded || 'Recently established'}
- Contact: ${phone || email || 'Available on website'}

Create an About page that:
1. Clearly explains what ${name} does
2. Establishes credibility and trust
3. Includes a "What We Do" section
4. Has a "Why Choose Us" section with specific benefits
5. Includes an FAQ section with 5-7 common questions
6. Has clear contact information

Format with proper Markdown headers. Make it comprehensive (800-1200 words) and AI-citation-friendly.`;

    case 'FAQ_PAGE':
      return `Write a comprehensive FAQ page for ${name}, a ${category} business${location ? ` in ${location}` : ''}.

Business: ${description || category + ' services'}
Services: ${services || category}

Create 12-15 frequently asked questions that cover:
1. "What is ${name}?" - Clear description
2. "What services does ${name} offer?" - Service details
3. "Where is ${name} located?" - Location info
4. "Is ${name} trustworthy?" - Trust signals
5. "Should I use ${name}?" - Why choose them
6. "Does ${name} have good reviews?" - Reputation
7. "How much does ${name} cost?" - Pricing info
8. "How do I contact ${name}?" - Contact details
9. "How do I get started with ${name}?" - Process
10. Questions specific to ${category}

Each answer should be 2-4 sentences, factual, and confident. Format as Markdown with ## for each question.`;

    case 'SERVICE_PAGE':
      const serviceName = extra?.serviceName || business.services?.[0] || category;
      return `Write a comprehensive service page for "${serviceName}" offered by ${name}${location ? ` in ${location}` : ''}.

Business: ${name} - ${description || category}

Create a service page that includes:
1. Clear H1 title for the service
2. Introduction explaining the service (2-3 paragraphs)
3. "What's Included" section with bullet points
4. "Our Process" section with numbered steps
5. "Why Choose ${name} for ${serviceName}" section
6. "Frequently Asked Questions" (5 questions specific to this service)
7. Clear call-to-action

Make it comprehensive (600-900 words), professional, and optimized for AI citation. Use Markdown formatting.`;

    case 'BLOG_POST':
      const topic = extra?.topic || `How to Choose the Right ${category}`;
      return `Write an informative blog post about: "${topic}"

This is for ${name}, a ${category} business${location ? ` in ${location}` : ''}.

Create a blog post that:
1. Has an engaging title (H1)
2. Includes an introduction hooking the reader
3. Has 4-6 main sections with H2 headers
4. Includes specific, actionable advice
5. References industry best practices
6. Has a conclusion with key takeaways
7. Naturally mentions ${name} once or twice as an example

Target length: 1000-1500 words. Use Markdown formatting. Include bullet points and numbered lists where appropriate.`;

    case 'TIKTOK_SCRIPT':
      return `Create 5 TikTok video scripts for ${name}, a ${category} business.

Each script should include:
- HOOK (first 2 seconds - must grab attention)
- BODY (main content - 15-45 seconds)
- CTA (call to action)
- Suggested hashtags

Script styles to include:
1. "POV" style - relatable scenario
2. "Day in the life" - behind the scenes
3. "Things I wish I knew" - expert tips
4. "Myth vs Reality" - bust a common misconception
5. "This is why" - explain a benefit

Make them authentic, engaging, and suitable for vertical video. Include stage directions in [brackets].`;

    case 'REVIEW_REQUEST':
      return `Create 3 review request templates for ${name}:

1. POST-PURCHASE EMAIL (send immediately after service)
- Subject line
- Friendly, personal tone
- Clear ask for review
- Include review link placeholder: {{review_link}}
- 100-150 words

2. FOLLOW-UP EMAIL (send 1 week later if no review)
- Subject line
- Gentle reminder tone
- 80-120 words

3. SMS TEMPLATE (short text message)
- Under 160 characters
- Casual but professional

Use {{customer_name}}, {{product_or_service}}, and {{review_link}} as placeholders.`;

    case 'CASE_STUDY':
      return `Write a case study template for ${name}.

Structure:
1. Title: "How [Customer] Achieved [Result] with ${name}"
2. The Challenge (what problem the customer faced)
3. The Solution (how ${name} helped)
4. The Process (step by step)
5. The Results (specific metrics and outcomes)
6. Customer Quote (placeholder for testimonial)
7. Key Takeaways

Use placeholders like {{customer_name}}, {{challenge}}, {{result}}, {{metric_before}}, {{metric_after}}.
Make it professional and results-focused. 500-700 words.`;

    case 'META_DESCRIPTION':
      return `Write 5 meta descriptions for ${name}'s website pages:

1. Homepage - 155 characters max
2. About page - 155 characters max
3. Services page - 155 characters max
4. Contact page - 155 characters max
5. Blog/Resources page - 155 characters max

Each should:
- Include "${name}" 
- Have a clear value proposition
- Include a subtle call-to-action
- Be compelling for searchers
- Include relevant keywords naturally

Format as a numbered list with the page name and description.`;

    default:
      return `Write professional content for ${name}, a ${category} business.`;
  }
}

// ===========================================
// AI GENERATION
// ===========================================

async function generateWithGPT(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || '';
}

// ===========================================
// CONTENT ANALYSIS
// ===========================================

function analyzeContent(content: string, businessName: string): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 50;
  
  const lowerContent = content.toLowerCase();
  
  // Business name mentions
  const nameCount = (content.match(new RegExp(businessName, 'gi')) || []).length;
  if (nameCount >= 3) {
    score += 10;
    notes.push('✓ Business name mentioned multiple times');
  } else if (nameCount === 0) {
    score -= 15;
    notes.push('✗ Business name not mentioned');
  }
  
  // Headers
  const headerCount = (content.match(/^#{1,3}\s/gm) || []).length;
  if (headerCount >= 4) {
    score += 10;
    notes.push('✓ Well-structured with headers');
  }
  
  // Lists
  if ((content.match(/^[-*]\s/gm) || []).length >= 3) {
    score += 5;
    notes.push('✓ Uses lists for clarity');
  }
  
  // Specific numbers
  if (/\d+/.test(content)) {
    score += 5;
    notes.push('✓ Contains specific data');
  }
  
  // Word count
  const wordCount = content.split(/\s+/).length;
  if (wordCount >= 500) {
    score += 10;
    notes.push('✓ Comprehensive length');
  } else if (wordCount < 200) {
    score -= 10;
    notes.push('✗ Content may be too short');
  }
  
  // FAQ format
  if ((content.match(/\?/g) || []).length >= 3) {
    score += 5;
    notes.push('✓ Contains FAQ-style questions');
  }
  
  return { score: Math.max(0, Math.min(100, score)), notes };
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

    const { businessId, contentType, additionalContext, serviceName, topic }: GenerateRequest = await req.json();

    if (!businessId || !contentType) {
      return new Response(
        JSON.stringify({ error: 'businessId and contentType are required' }),
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

    // Generate content
    const systemPrompt = getSystemPrompt();
    const userPrompt = getContentPrompt(contentType, business, { serviceName, topic, additionalContext });
    
    const generatedContent = await generateWithGPT(systemPrompt, userPrompt);
    
    // Analyze for AI optimization
    const analysis = analyzeContent(generatedContent, business.name);
    
    // Generate title
    let title = '';
    switch (contentType) {
      case 'ABOUT_PAGE':
        title = `About ${business.name}`;
        break;
      case 'FAQ_PAGE':
        title = `FAQ - ${business.name}`;
        break;
      case 'SERVICE_PAGE':
        title = `${serviceName || 'Services'} - ${business.name}`;
        break;
      case 'BLOG_POST':
        title = topic || `Blog Post - ${business.name}`;
        break;
      case 'TIKTOK_SCRIPT':
        title = `TikTok Scripts for ${business.name}`;
        break;
      case 'REVIEW_REQUEST':
        title = `Review Request Templates`;
        break;
      case 'CASE_STUDY':
        title = `Case Study Template`;
        break;
      case 'META_DESCRIPTION':
        title = `Meta Descriptions for ${business.name}`;
        break;
      default:
        title = `Content for ${business.name}`;
    }
    
    const wordCount = generatedContent.split(/\s+/).length;
    
    // Store in database
    const { data: content, error: contentError } = await supabase
      .from('generated_content')
      .insert({
        business_id: businessId,
        content_type: contentType,
        title,
        content: generatedContent,
        word_count: wordCount,
        reading_time_minutes: Math.ceil(wordCount / 200),
        ai_optimization_score: analysis.score,
        ai_optimization_notes: analysis.notes,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (contentError) {
      throw new Error(`Failed to store content: ${contentError.message}`);
    }

    // Update user usage (if tracking)
    await supabase.rpc('increment_articles_used', { user_id: business.user_id }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        content: {
          id: content.id,
          title,
          content: generatedContent,
          wordCount,
          aiOptimizationScore: analysis.score,
          aiOptimizationNotes: analysis.notes,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Content Generation Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
