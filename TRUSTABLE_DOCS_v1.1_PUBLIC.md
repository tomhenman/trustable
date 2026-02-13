# Trustable Labs — Product & Technical Documentation

**Version:** 1.1 Public  
**Date:** February 2026  
**Website:** trustablelabs.com

---

## Table of Contents

1. [What Trustable Does](#1-what-trustable-does)
2. [Supported AI Platforms](#2-supported-ai-platforms)
3. [Hybrid Scoring System](#3-hybrid-scoring-system)
4. [AI Recommendation Simulation](#4-ai-recommendation-simulation)
5. [The Entity-Stuffing Discovery](#5-the-entity-stuffing-discovery)
6. [Complete Feature Suite (20 Features)](#6-complete-feature-suite-20-features)
7. [AI Copilot](#7-ai-copilot)
8. [Competitive Intelligence](#8-competitive-intelligence)
9. [Plan Tiers & Access](#9-plan-tiers--access)
10. [Enterprise Integration](#10-enterprise-integration)
11. [Pilot Programme](#11-pilot-programme)
12. [Why Trustable Is Different](#12-why-trustable-is-different)

---

## 1. What Trustable Does

Trustable is an AI visibility measurement and optimisation platform. It models how AI systems retrieve, evaluate, and present information about brands — then provides the data and tools to improve those outcomes.

When a potential customer asks ChatGPT, Claude, Perplexity, Gemini, or any major AI assistant "What's the best [service] in [location]?", the AI constructs a response by evaluating trust signals, content quality, authority markers, and sentiment across the web. Trustable measures exactly how that evaluation plays out for your brand, scores it across 14 dimensions, and tells you precisely what to change.

This is not traditional SEO. AI systems don't use keyword rankings or backlink profiles the way search engines do. They synthesise information differently — and Trustable is built from the ground up to model that synthesis.

### Core capabilities

- **Measure** how 8 AI platforms perceive and present your brand
- **Score** your AI readiness across 14 metrics using a dual scoring framework
- **Simulate** real buyer queries to see if AI would recommend you
- **Compare** your AI visibility against competitors in real time
- **Optimise** content for AI retrieval using semantically-validated methods
- **Monitor** changes in AI behaviour toward your brand over time
- **Act** with auto-generated action plans, content briefs, and copy-paste fixes

---

## 2. Supported AI Platforms

Trustable queries AI platforms directly to measure how they respond to real buyer queries about your brand.

| Platform | Type | Coverage |
|----------|------|----------|
| **ChatGPT** (OpenAI) | Conversational AI | Full query + response analysis |
| **Claude** (Anthropic) | Conversational AI | Full query + response analysis |
| **Perplexity** | AI Search | Full query + response analysis |
| **Gemini** (Google) | Conversational AI | Full query + response analysis |
| **Copilot** (Microsoft) | AI Assistant | Full query + response analysis |
| **Grok** (xAI) | Conversational AI | Full query + response analysis |
| **DeepSeek** | Conversational AI | Full query + response analysis |
| **Google AI Overviews** | Search AI | Full query + response analysis |

Platform access scales with plan tier. All plans include ChatGPT. Higher tiers unlock additional platforms for cross-model visibility analysis.

---

## 3. Hybrid Scoring System

Trustable implements a **dual scoring framework** with **14 individual metrics**, each scored 0–100. Every score is deterministic, explainable, and reproducible.

### Framework A: AI Trust & Visibility Scores

These scores measure how AI systems perceive and present your brand:

| Score | What It Measures |
|-------|-----------------|
| **AI Visibility Score** | How often AI mentions your brand when asked relevant questions |
| **AI Trust Score** | Composite measure of sentiment strength, hedging absence, recommendation likelihood, and negative mention avoidance |
| **AI Recommendation Score** | How frequently and strongly AI recommends your brand, weighted by recommendation strength |
| **AI Citation Score** | How often AI links directly to your website or content |
| **Sentiment Score** | Net sentiment polarity across all AI responses about your brand |
| **Confidence Score** | How confidently AI speaks about your brand (absence of qualifiers and hedging language) |
| **Local Visibility Score** | AI visibility for location-specific queries, factoring in local business data completeness |
| **Social Discovery Score** | Breadth of social media presence that AI systems can reference |
| **Overall AI Readiness Score** | Weighted composite of all trust and visibility metrics, graded A+ through F |

The AI Trust Score uses a multi-component weighted formula incorporating sentiment analysis, hedging detection, recommendation tracking, and negative mention monitoring. The specific weights are calibrated through empirical testing against real AI platform behaviour.

### Framework B: Technical & Content Scores

These scores evaluate your web presence through the lens of AI retrievability:

| Score | What It Measures |
|-------|-----------------|
| **Technical Score** | Starts at 100 and deducts for issues that impair AI crawlability: missing schema, meta data gaps, performance problems, broken links |
| **Content Score** | Per-page quality assessment: word count adequacy, header structure, title/meta quality, schema markup, link profile, image accessibility |
| **AEO Score** | Answer Engine Optimisation readiness: schema richness, AI mention rate, citation rate, question targeting, structured content |
| **Overall Health Score** | Weighted composite of technical, content, and AEO scores |

### Score Explainability

Every score includes:

- **Component breakdown** — each factor's contribution to the final score
- **Top drivers** — the specific positive and negative factors with impact values
- **Risk flags** — issues rated by severity (critical, high, medium) with descriptions
- **Recommended actions** — prioritised fixes with expected impact and category

This is not a black box. Every number is traceable to specific, actionable factors.

---

## 4. AI Recommendation Simulation

The Simulation Engine answers the question every business needs answered: **"If a customer asked AI for a recommendation right now, would it recommend me?"**

### How it works

1. **17 query templates** across 5 categories (recommendation, trust, alternatives, purchase intent, comparison) are populated with your actual brand details, services, location, and competitor names
2. Each query is sent to your selected AI platforms
3. Every response is analysed for: brand mention, recommendation strength, winner identification, sentiment, and competitive positioning
4. When your brand loses, a **gap analysis** identifies exactly what signals the winning competitor had that you didn't

### Output

- Win/loss rate across all queries and platforms
- Biggest competitive threat identified
- Most common missing signal
- Per-query breakdown with winner, confidence level, and gap analysis
- Tracked over time to measure improvement

This is the closest thing to a controlled experiment on AI recommendation behaviour that exists in the market.

---

## 5. The Entity-Stuffing Discovery

Early in development, Trustable tested the prevailing GEO (Generative Engine Optimisation) recommendations being promoted across the SEO industry: increase entity density, remove pronouns, front-load definitions, and add structured entity references.

### The test

We applied standard entity-stuffing optimisation to live content and measured the impact on AI retrieval probability using cosine similarity against real query embeddings.

### The result

| Metric | Before Optimisation | After Optimisation | Change |
|--------|--------------------|--------------------|--------|
| Cosine similarity to target queries | 55.48% | 49.44% | **−15%** |

**Entity stuffing made AI retrieval worse, not better.**

The standard industry recommendations — the ones being sold as GEO services — actively reduced the probability that AI systems would surface the optimised content.

### Why this matters

Most AI visibility tools and agencies are applying SEO-era thinking to a fundamentally different retrieval mechanism. AI systems use embedding-based semantic matching, not keyword frequency. Increasing entity density can actually push content *away* from the query embeddings that matter.

Trustable's optimisation engine detected this regression automatically and blocked the deployment. Our approach requires **query-specific semantic alignment** — optimising content to match the actual embedding space of real buyer queries, validated before deployment.

This is the difference between guessing and measuring.

---

## 6. Complete Feature Suite (20 Features)

### Hero Features

#### 1. AI Recommendation Simulation
Simulates real buyer queries across AI platforms. 17 templates across 5 categories. Full winner analysis with gap breakdown. Session tracking for longitudinal measurement.

#### 2. "Why You Lost" Breakdown
When AI prefers a competitor, this feature identifies the deciding factor. Compares 15+ trust signals across 5 categories (content, trust, authority, technical, social). Generates prioritised fixes with effort estimates, expected impact, timeline, and example wording.

#### 3. Trust Drift Timeline
Tracks how AI's perception of your brand changes over time. Detects improvement events, declines, anomalies, and competitor-driven shifts with causal analysis. Generates 30/60/90-day forecasts with optimistic, realistic, and pessimistic scenarios.

#### 4. Language Alignment Score
Measures how closely your brand's language matches the language AI naturally uses when describing your category. Includes industry-specific language patterns. Generates phrase-level recommendations to close alignment gaps.

#### 5. 14-Day Action Plan
Auto-generated day-by-day plan with: prioritised daily tasks with time estimates, copy-paste content snippets, review request templates (email, SMS, in-person scripts), platform-specific social post scripts with optimal timing, and pages to create.

#### 6. Trust Badge
Embeddable verification badge for your website in 3 tiers: Monitored, Verified, and Certified (based on score thresholds). Generates embed code. Tracks impressions, clicks, and verification checks.

### Competitive Intelligence

#### 7. Competitor Intelligence System
7 alert types monitoring competitor movements. Intelligence feed with daily/weekly digests. Category leaderboard with position tracking. Content gap finder identifying topics where competitors have AI visibility and you don't.

### AI Insights

#### 8. AI Insights Engine
"What Would AI Say About Me?" — generates a preview of how AI would describe your brand. Before/After preview for proposed changes. Brand Safety Monitor for detecting misinformation. Quote extraction from real AI responses.

### Engagement & Retention

#### 9. Quick Wins Dashboard
Surfaces the top 3 things you can fix in under 10 minutes. Copy-paste ready. Includes streak tracking for team engagement.

#### 10. Weekly Digest
Automated email digest: score changes with trend arrows, threats detected, opportunities identified, quick wins, notable AI quotes about your brand, and competitor updates.

#### 11. Ask the AI Widget
Embeddable widget for your website that lets visitors ask questions about your brand. Supports live and curated response modes. Built-in safety guardrails with blocked topics and disclaimers. Analytics on what visitors are asking.

### Marketplace & Community

#### 12. Prompt Library
Community-driven prompt packs organised by industry and location. Official, community, and verified author types. Usage stats, ratings, and effectiveness scoring.

### Tracking & Evidence

#### 13. Response Changelog
Tracks exactly how AI responses about your brand change over time. Detects 8 change types: improvements, declines, new mentions, lost mentions, position changes, sentiment shifts, and competitor additions/removals. Extracts key quotes flagged as testimonial-usable.

#### 14. Category Benchmark
Compare your scores to category averages and top 10%. Percentile ranking, gap-to-close analysis, and auto-generated 30/90-day improvement goals.

### Premium Services

#### 15. "Fix It For Me" Done-For-You
Premium managed service in 3 tiers. Task queue with approval workflow. Weekly performance reports tracking impact of completed work.

### Proof & Compliance

#### 16. Proof Mode Widget
Embeddable widget displaying real AI quotes about your brand. Auto-refresh with quote rotation. Positive-only filter. Impression tracking for measuring engagement.

#### 17. AI Audit Trail
Timestamped, tamper-evident log of every AI response about your brand. Response integrity verification via hashing. Fact-checking and issue detection (incorrect information, negative claims, missing context). Compliance-grade reporting with full export.

#### 18. Recovery Playbook
Auto-generated when scores drop significantly. Multi-phase recovery plans triggered by score drops, visibility loss, negative reviews, or competitor surges. Progress tracking comparing score-at-start to current performance.

#### 19. Monitoring Integrity Score
Measures how comprehensive your monitoring setup is. Evaluates 6 categories: platform coverage, prompt diversity, competitor tracking, integration completeness, alert configuration, and engagement. Gamifies thorough product usage.

#### 20. Site Audit Engine
Full website technical audit evaluating 30+ issue types across multiple severity levels. Per-page analysis of content quality, schema markup, header structure, meta data, performance, and crawlability. Issues include specific remediation guidance.

---

## 7. AI Copilot

The AI Copilot is a strategic advisor built into the platform. It operates with full context awareness — every conversation is informed by your live scores, scan history, audit results, review data, competitor benchmarks, and plan details.

### Three operating modes

| Mode | Purpose | Style |
|------|---------|-------|
| 🔍 **Diagnose** | Investigate problems, explain scores, identify root causes | Analytical, evidence-based |
| ⚡ **Action** | Generate fixes, create content, build plans | Direct, actionable, template-ready |
| 📊 **Report** | Summarise status, generate stakeholder updates | Concise, high-level, presentation-ready |

### 17 tools across 5 categories

| Category | Capabilities |
|----------|-------------|
| **Analysis** | Explain any score in plain language, surface the specific drivers behind score changes, compare your performance to any tracked competitor, analyse trust drift patterns |
| **Strategy** | Identify priority fixes ranked by impact, recommend what to fix first with reasoning, generate full action plans |
| **Content** | Generate prompt sets for monitoring, create content briefs optimised for AI retrieval, fix specific audit issues with ready-to-implement solutions, draft review responses |
| **Simulation** | Run recommendation simulations on demand, analyse why you lost specific queries, evaluate language alignment |
| **Reporting** | Generate executive reports, export action plans, create 14-day improvement plans |

### Structured response format

Every Copilot response follows a consistent structure:

1. **What I Think Is Happening** — direct diagnosis
2. **Why It Matters** — business impact
3. **Top 3 Fixes** — prioritised table with impact and effort
4. **Exact Wording** — copy-paste ready before/after text
5. **What To Do** — today and this-week checklists
6. **Confidence & Citations** — confidence level with reasoning and data sources

### Advanced capabilities

- **Confidence modelling** with explicit assumptions, missing data inventory, and counterfactuals ("what would change this assessment")
- **Opportunity cost analysis** — quantifies what you'd gain by *not* pursuing low-impact activities
- **Adversarial scenario testing** — stress-tests your AI presence against hypothetical competitive moves
- **Learning from outcomes** — tracks predicted vs actual score changes to improve future recommendations

---

## 8. Competitive Intelligence

Trustable runs the same AI platform queries for your competitors that it runs for you, generating direct head-to-head comparisons.

### What you get

| Capability | Detail |
|-----------|--------|
| **Score comparison** | Your visibility, trust, recommendation, and citation scores vs each competitor, with exact differences |
| **Share of voice** | Platform-by-platform visibility percentages across your competitive set |
| **7 alert types** | Score increases, new content detection, review spikes, schema additions, visibility surges, new competitors entering the space, ranking changes |
| **Content gap analysis** | Topics where competitors have AI visibility and you don't, with recommendations to close gaps |
| **Category leaderboard** | Ranked position within your category with trend tracking |
| **Intelligence digests** | Daily or weekly summaries of all competitor movements with recommended responses |

### Competitive monitoring is continuous

Competitor scans run on the same schedule as your own monitoring. Every scan updates benchmarks, recalculates share of voice, and evaluates alert rules. You see competitive shifts as they happen, not after the fact.

---

## 9. Plan Tiers & Access

### Tier overview

| Tier | Positioning | Key differentiators |
|------|------------|-------------------|
| **Free** | Trial / evaluation | Single platform, limited queries, basic scoring |
| **Starter** | Small businesses getting started | Core monitoring, basic Copilot access, limited competitor tracking |
| **Professional** | Active optimisation | Multi-platform monitoring, full Copilot with tool execution, simulation engine, scheduled reports |
| **Scale** | Agencies and multi-location brands | High-volume monitoring, white-label reports, priority support, extended platform coverage |
| **Custom / Enterprise** | Enterprise and DXP integration | Unlimited everything, full API access, all platforms including Grok and DeepSeek, custom SLAs |

### Platform access by tier

| Tier | Platforms included |
|------|-------------------|
| Free / Starter | ChatGPT |
| Professional | + Perplexity, Google AI, Gemini |
| Scale | + Claude, Copilot |
| Custom | + Grok, DeepSeek (all 8 platforms) |

### Feature access by tier

| Feature | Free | Starter | Professional | Scale | Custom |
|---------|------|---------|-------------|-------|--------|
| AI visibility scanning | ✅ | ✅ | ✅ | ✅ | ✅ |
| 14-metric scoring | ✅ | ✅ | ✅ | ✅ | ✅ |
| Competitor tracking | Limited | Limited | ✅ | ✅ | ✅ |
| AI Copilot | ❌ | Basic | Full | Full | Full |
| Copilot tool execution | ❌ | ❌ | ✅ | ✅ | ✅ |
| Simulation engine | ❌ | ❌ | ✅ | ✅ | ✅ |
| Export reports | ❌ | ❌ | ✅ | ✅ | ✅ |
| Multi-region monitoring | ❌ | ❌ | ✅ | ✅ | ✅ |
| Scheduled reports | ❌ | ❌ | ✅ | ✅ | ✅ |
| White-label | ❌ | ❌ | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 10. Enterprise Integration

### API-first architecture

Every Trustable capability is accessible via REST API with OpenAPI-compatible endpoint definitions. Enterprise clients can integrate AI visibility data directly into existing systems.

### Integration methods

| Method | Description |
|--------|------------|
| **REST API** | Full programmatic access to all scanning, scoring, content generation, and reporting capabilities |
| **Outbound webhooks** | Push notifications for alerts, score changes, and scan completions to your systems (HMAC-signed for security) |
| **Inbound webhooks** | Trigger scans and ingest data from external systems |
| **SSO** | Enterprise single sign-on support |
| **White-label** | Custom branding on reports, badges, and client-facing outputs |
| **Data export** | JSON and CSV export for all report types, with direct database access available for custom BI integration |

### DXP integration pattern

For enterprise teams using Digital Experience Platforms:

1. **Content publishing** → API-triggered scans run automatically when content is published
2. **Dashboard integration** → Score data pulled into existing DXP dashboards via REST
3. **Alert routing** → Webhook notifications pushed to your existing notification systems
4. **Content editing** → Content generation API called from within your CMS/DXP editors
5. **Governance** → Audit results integrated into your content governance workflows

### Multi-tenant support

Organisation-level accounts with workspace isolation, role-based access, and centralised billing. Designed for agencies managing multiple client brands.

---

## 11. Pilot Programme

### Structure

Trustable offers a structured pilot programme for enterprise prospects and agencies evaluating the platform.

**Phase 1: Baseline (Week 1)**
- Configure brand profile with competitors, services, and target regions
- Run initial scans across all available AI platforms
- Generate baseline scores across all 14 metrics
- Produce competitive benchmark report
- Run first AI recommendation simulation

**Phase 2: Optimisation (Weeks 2–3)**
- Auto-generate 14-day action plan based on baseline gaps
- Execute priority fixes identified by the scoring system
- Run language alignment analysis and implement recommendations
- Re-scan to measure initial impact

**Phase 3: Validation (Week 4)**
- Full comparative scan: before vs after across all metrics
- Competitive position change report
- Simulation re-run to measure recommendation rate improvement
- Executive summary with ROI indicators

### Pilot deliverables

- Complete baseline report with 14 scores and competitive benchmarks
- Prioritised action plan with effort/impact analysis
- Before/after comparison across all metrics
- Competitive intelligence digest
- AI recommendation simulation results (before and after)
- Executive summary suitable for stakeholder presentation

---

## 12. Why Trustable Is Different

### vs. Traditional SEO tools

Traditional SEO tools measure keyword rankings, backlink profiles, and search engine result pages. AI systems don't use any of these signals in the same way. They evaluate content semantically through embedding-based retrieval. Trustable is built for this new paradigm — it measures what AI actually does with your content, not what search engines do.

### vs. "GEO" offerings

Most Generative Engine Optimisation services are applying SEO-era tactics (entity stuffing, keyword density, backlink strategies) to AI visibility. Our own testing proved this approach can actively harm AI retrieval probability (−15% in controlled testing). Trustable uses embedding-validated, query-specific semantic alignment — and blocks optimisations that would cause regression.

### vs. Brand monitoring tools

Brand monitoring tools track mentions across social media and press. Trustable tracks how AI systems specifically respond to buyer-intent queries about your brand. The difference: we're measuring the AI's *recommendation behaviour*, not just whether your name appears somewhere online.

### vs. Building it yourself

The Trustable platform represents 17,000+ lines of purpose-built code across 50+ modules: scoring engines, simulation frameworks, competitive intelligence, drift detection, content generation, and a full AI Copilot. This is not a wrapper around an API call. It's a measurement and optimisation system built from first principles for the specific problem of AI visibility.

### The core thesis

AI is becoming the primary discovery layer for services, products, and brands. The businesses that measure and optimise for AI visibility now will have a structural advantage as AI-mediated discovery grows. Trustable provides the measurement infrastructure to make that optimisation data-driven rather than speculative.

---

*Trustable Labs — trustablelabs.com*  
*For enterprise enquiries: Contact us at trustablelabs.com*
