# Auditure Pricing Strategy & Financial Analysis

> Comprehensive documentation covering subscription tiers, cost structure, scaling projections, and business model recommendations.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Subscription Tiers](#2-subscription-tiers)
3. [Cost Structure](#3-cost-structure)
4. [Download-to-Revenue Funnel](#4-download-to-revenue-funnel)
5. [The Free Tier Problem](#5-the-free-tier-problem)
6. [Add-On Features](#6-add-on-features)
7. [Infrastructure Costs](#7-infrastructure-costs)
8. [Scaling Projections](#8-scaling-projections)
9. [Break-Even Analysis](#9-break-even-analysis)
10. [Utilization Monitoring](#10-utilization-monitoring)
11. [Recommendations](#11-recommendations)

---

## 1. Executive Summary

### Key Metrics

| Metric | Value |
|--------|-------|
| Break-even downloads | ~8,000 |
| Break-even paying users | ~48 |
| Time to profitability | ~6 months |
| Target margin at scale | 10-15% (80%+ with Higgs) |
| Runway required | $6,000-12,000 |

### Critical Insight

**Free tier uses hybrid model (1 Gemini + 2 Standard)** to balance:
- User experience: Premium "aha moment" drives conversions
- Cost control: Realistic usage ~$0.17/user/month
- Upgrade incentive: "I want all my episodes in multi-speaker"

### TTS Strategy

| Phase | TTS Provider | Cost/Episode | Why |
|-------|--------------|--------------|-----|
| **MVP** | Gemini 2.5 Flash TTS | ~$0.15 | Multi-speaker, podcast-optimized, natural dialogue |
| **Premium** | Gemini 2.5 Pro TTS | ~$0.30 | Highest quality for premium users |
| **Scale (10K+ eps/mo)** | Higgs Audio V2 (self-hosted) | ~$0.02 | 7-15x cost reduction |

### MVP Scope

| Feature | MVP | Post-MVP |
|---------|-----|----------|
| Episode length | 5-10 min | 11-30 min (chunked), 45-90 min (add-on) |
| Voice quality | Hybrid (1 Gemini + 2 Std) for free, Gemini Flash for paid | Higgs Audio (cost optimization) |
| Episode types | Monologue, Duo, Group | - |
| Voice accents | 6 regions | Additional regions |
| Priority queue | No | Yes (add-on) |
| Multi-speaker | 1/mo free, unlimited paid | - |
| Natural dialogue | Chaos-based interruptions and backchannels | - |

---

## 2. Subscription Tiers

### Recommended Tier Structure

| Plan | Price | Episodes/mo | Voice Quality | Target User |
|------|-------|-------------|---------------|-------------|
| **Free** | $0 | 3 | 1 Gemini Pro + 2 Standard | Try before buy |
| **Starter** | $9.99 | 30 | Gemini Pro | Casual readers |
| **Pro** | $24.99 | 100 | Gemini Pro | Power users |

### Feature Matrix

| Feature | Free | Starter | Pro |
|---------|------|---------|-----|
| Episodes per month | 3 (1 Pro + 2 Std) | 30 | 100 |
| Voice quality | Hybrid | Gemini 2.5 Pro | Gemini 2.5 Pro |
| Episode length | 5-10 min | 5-10 min | 5-10 min |
| Multi-speaker | 1 episode/mo | Yes (up to 9) | Yes (up to 9) |
| Voice accents | 6 accents | 6 accents | 6 accents |
| Podcaster personalities | 2 | 10 | Unlimited |
| Episode types | Monologue + 1 Duo | Mono + Duo | All (Mono, Duo, Group) |
| Download episodes | No | Yes | Yes |
| Priority generation | No | No | Yes |
| Custom podcaster creation | No | No | Yes |
| Non-verbal cues | 1 episode/mo | Yes ([sigh], [laugh]) | Yes |
| Style prompts | 1 episode/mo | Yes | Yes |

### Supported Voice Accents (6 total)

| Accent | Google Cloud Voice |
|--------|-------------------|
| United States | en-US |
| United Kingdom | en-GB |
| Australia | en-AU |
| Canada | en-US |
| Ireland | en-GB |
| India | en-IN |

### Revenue Per User

| Plan | Price | Expected Mix | Revenue Contribution |
|------|-------|--------------|---------------------|
| Free | $0 | 95% of active | $0 |
| Starter | $9.99 | 4% of active | 80% of revenue |
| Pro | $24.99 | 1% of active | 20% of revenue |

**Weighted Average Revenue Per Paying User:** ~$11.99/month

---

## 3. Cost Structure

### Per-Episode Costs (10-minute episode)

| Component | Cost | Notes |
|-----------|------|-------|
| **TTS - Standard** | $0.024 | Google Cloud Standard voices ($4/1M chars) |
| **TTS - Gemini 2.5 Flash** | $0.15 | Podcast-optimized, multi-speaker ($10/1M audio tokens) |
| **TTS - Gemini 2.5 Pro** | $0.30 | Highest quality ($20/1M audio tokens) |
| **TTS - Higgs Audio** | $0.02 | Self-hosted on RunPod RTX 4090 ($0.59/hr) |
| **LLM (GPT-4o mini)** | $0.003 | Script generation |
| **Storage (S3)** | $0.0001 | ~4MB per episode |
| **CDN (per 10 plays)** | $0.04 | CloudFront delivery |

### Cost Breakdown by Voice Tier

| Voice Tier | TTS | LLM | Storage | CDN | **Total/Episode** |
|------------|-----|-----|---------|-----|-------------------|
| Standard | $0.024 | $0.003 | $0.0001 | $0.04 | **$0.07** |
| Gemini 2.5 Flash | $0.15 | $0.003 | $0.0001 | $0.04 | **$0.19** |
| Gemini 2.5 Pro | $0.30 | $0.003 | $0.0001 | $0.04 | **$0.34** |
| Higgs Audio (future) | $0.02 | $0.003 | $0.0001 | $0.04 | **$0.06** |

### Free Tier Cost (Hybrid: 1 Gemini + 2 Standard)

| Usage Pattern | Avg Episodes | Gemini Episodes | Std Episodes | Cost/User/Mo |
|---------------|--------------|-----------------|--------------|--------------|
| Power user | 3.0 | 1.0 | 2.0 | $0.33 |
| **Realistic** | 1.5 | 0.5 | 1.0 | **$0.17** |
| Light user | 1.0 | 0.33 | 0.67 | $0.11 |

*Realistic assumes 50% of free users use their full allocation*

### Gemini 2.5 Flash TTS Pricing Details (Default)

| Component | Rate | Per 10-min Episode |
|-----------|------|-------------------|
| Input tokens | $0.50/1M tokens | ~$0.01 |
| Audio output | $10.00/1M tokens | ~$0.15 |
| **Total** | | **~$0.15** |

*Audio tokens = 25 tokens per second of audio*
*10 min = 600 sec × 25 = 15,000 audio tokens*

### Gemini 2.5 Pro TTS Pricing Details (Premium)

| Component | Rate | Per 10-min Episode |
|-----------|------|-------------------|
| Input tokens | $1.00/1M tokens | ~$0.02 |
| Audio output | $20.00/1M tokens | ~$0.30 |
| **Total** | | **~$0.30** |

### Gemini TTS Limitations

| Limitation | Value | Workaround |
|------------|-------|------------|
| Max output duration | ~11 minutes (655 sec) | Chunk + stitch for longer |
| Max text input | 4,000 bytes | Split script |
| Max speakers | 9 per request | Sufficient for podcasts |

### Why GPT-4o Mini Over GPT-3.5?

| Model | Input Cost | Output Cost | Quality |
|-------|------------|-------------|---------|
| GPT-3.5 Turbo | $3.00/1M | $6.00/1M | Good |
| **GPT-4o mini** | **$0.15/1M** | **$0.60/1M** | Better |

**GPT-4o mini is 60% cheaper with better output quality.**

---

## 4. Download-to-Revenue Funnel

### Conversion Rates (Industry Benchmarks)

```
Downloads (100%)
    ↓ 40% register
Registered Users (40%)
    ↓ 30% become active
Monthly Active Users (12%)
    ↓ 5% convert to paid
Paying Subscribers (0.6%)
```

### Funnel Example: 10,000 Downloads

| Stage | Count | Episodes/mo | Revenue |
|-------|-------|-------------|---------|
| Downloads | 10,000 | - | - |
| Registered | 4,000 | - | - |
| Active (MAU) | 1,200 | - | - |
| Free users | 1,140 | 3,420 | $0 |
| Paying users | 60 | 900 | $720 |
| **Total** | - | **4,320** | **$720** |

### Key Ratios

| Metric | Value |
|--------|-------|
| Downloads to Paying | 0.6% |
| Free to Paid episodes | 3.8:1 |
| Revenue per download | $0.072 |
| LTV per paying user | ~$72 (6 month avg retention) |

---

## 5. The Free Tier Strategy

### Hybrid Model (Implemented)

Free users receive **1 Gemini Pro + 2 Standard episodes per month**. This provides:
- A taste of premium multi-speaker experience
- Clear quality gap to drive upgrades
- Sustainable unit economics

| Tier | Episodes | Voice | Avg Cost/User/Mo |
|------|----------|-------|------------------|
| **Free** | 3 (1 Pro + 2 Std) | Hybrid | $0.28 (realistic) |
| Starter | 30 | Gemini 2.5 Pro | $10.80 |
| Pro | 100 | Gemini 2.5 Pro | $36.00 |

### Why Hybrid Over All-Standard?

| Approach | Cost/User | Conversion Driver | Risk |
|----------|-----------|-------------------|------|
| 3 Standard | $0.18 | Quality gap (hear vs experience) | Users don't "get it" |
| **1 Pro + 2 Std** | $0.28 | "Aha moment" + desire for more | +55% cost |
| 3 Pro | $1.08 | None (already satisfied) | No upgrade incentive |

**The hybrid approach costs ~$0.10/user more but creates a compelling "I want all my episodes like this" moment.**

### Conversion Impact

| Metric | All-Standard | Hybrid Model |
|--------|--------------|--------------|
| Free tier cost (10K DL) | $103/mo | $160/mo |
| Break-even conversion | 5.0% | 6.0% |
| Expected conversion | 5.0% | 5.5-6.5% |
| Net impact | Baseline | +$50-150/mo revenue |

*Hybrid model pays for itself if conversion improves by 20% (5% → 6%)*

---

## 6. Add-On Features (Post-MVP)

> **Note:** Add-on features are planned for implementation after MVP launch, once the core subscription model is validated and user demand is confirmed.

### What Are Add-Ons?

Pay-per-use upgrades purchased on top of subscriptions for specific episodes.

### Why Add-Ons?

Some features are too expensive for flat-rate subscriptions:
- Extended episodes (11-30 min requires chunking due to Gemini's 11-min limit)
- Extra-long episodes (45-90 minutes, multiple chunks)
- Rush processing (infrastructure overhead)

### Add-On Pricing

| Add-On | Your Cost | Price | Margin |
|--------|-----------|-------|--------|
| **Extended (11-30 min)** | $0.64-$0.96 | $1.49-$1.99 | 52% |
| **Long-form (45-90 min)** | $1.44-$2.88 | $2.99-$4.99 | 42% |
| **Priority Queue** | $0.10 | $0.99 | 90% |
| **Bundle (Long + Priority)** | $2.98 | $4.99 | 40% |

### User Flow

1. User creates episode within subscription limits
2. Optional add-ons displayed at generation screen
3. User selects add-ons → in-app purchase
4. Episode generates with premium features

### Extended Episode Technical Details (Post-MVP)

Standard LLM output limit: ~16,000 tokens ≈ 84 minutes max

**Extended Episode Tiers:**
| Duration | Chunks | Use Case |
|----------|--------|----------|
| 45 min | 2 | Medium-form content |
| 60 min | 2 | Long-form content |
| 90 min | 3 | Deep dives |

**Chunk Generation Process:**
1. Split book content into multiple segments
2. Generate scripts with transition prompts
3. Include context overlap between chunks
4. Concatenate audio files
5. Deliver as single episode

---

## 7. Infrastructure Costs

### Monthly Fixed Costs by Scale

| Component | MVP | Growth | Scale | Enterprise |
|-----------|-----|--------|-------|------------|
| | (<10K DL) | (10-100K) | (100-500K) | (500K+) |
| **Database (RDS)** | $0-22 | $45 | $180 | $500 |
| **Redis (ElastiCache)** | $0-12 | $25 | $50 | $200 |
| **RabbitMQ (CloudAMQP)** | $0 | $19 | $99 | $499 |
| **Core API (Fargate)** | $15 | $30 | $120 | $480 |
| **AI Workers (Fargate)** | $30 | $60 | $300 | $600 |
| **Storage (S3)** | $0.01 | $0.16 | $2 | $12 |
| **CDN (CloudFront)** | $0 | $6 | $64 | $425 |
| **Load Balancer** | $0 | $0 | $20 | $50 |
| **Monitoring** | $0 | $0 | $0 | $100 |
| **TOTAL** | **$75** | **$185** | **$835** | **$2,866** |

### AWS Free Tier Benefits (First 12 Months)

| Service | Free Allocation | Savings |
|---------|-----------------|---------|
| RDS db.t3.micro | 750 hours/month | ~$22/mo |
| ElastiCache | 750 hours/month | ~$12/mo |
| S3 | 5GB storage | ~$0.12/mo |
| CloudFront | 1TB transfer | ~$85/mo |
| **Total Year 1 Savings** | | **~$1,400** |

---

## 8. Scaling Projections

### With Hybrid Free Tier (1 Pro + 2 Standard)

*Assumes realistic 50% usage rate for free users*

| Downloads | Active | Paying | Free Episodes | Paid Episodes | Revenue | Costs | **Margin** |
|-----------|--------|--------|---------------|---------------|---------|-------|------------|
| 1,000 | 120 | 6 | 171 | 90 | $72 | $145 | -101% |
| 5,000 | 600 | 30 | 855 | 450 | $360 | $540 | -50% |
| **8,000** | **960** | **48** | **1,368** | **720** | **$575** | **$575** | **0%** |
| 10,000 | 1,200 | 60 | 1,710 | 900 | $720 | $710 | +1% |
| 25,000 | 3,000 | 150 | 4,275 | 2,250 | $1,800 | $1,700 | +6% |
| 50,000 | 6,000 | 300 | 8,550 | 4,500 | $3,600 | $3,300 | +8% |
| 100,000 | 12,000 | 600 | 17,100 | 9,000 | $7,200 | $6,500 | +10% |

*Free episodes = Free users × 1.5 avg; Paid episodes = Paying users × 15 avg*

### With Higgs Audio Migration (10K+ episodes/month)

| Downloads | Episodes | Revenue | Gemini Cost | Higgs Cost | **Margin (Higgs)** |
|-----------|----------|---------|-------------|------------|-------------------|
| 100,000 | 43,200 | $7,200 | $6,200 | $1,100 | **+85%** |
| 250,000 | 108,000 | $18,000 | $15,400 | $2,400 | **+87%** |
| 500,000 | 216,000 | $36,000 | $30,800 | $4,600 | **+87%** |

*Higgs Audio costs assume RunPod RTX 4090 at $0.59/hr + DevOps overhead*

### Growth Timeline

| Milestone | Downloads | Revenue/mo | TTS Provider | Margin | Status |
|-----------|-----------|------------|--------------|--------|--------|
| Month 1 | 500 | $36 | Gemini Pro | -200% | Investing |
| Month 3 | 2,000 | $144 | Gemini Pro | -50% | Improving |
| **Month 6** | **8,000** | **$575** | **Gemini Pro** | **0%** | **Break-even** |
| Month 9 | 15,000 | $1,080 | Gemini Pro | +5% | Profitable |
| Month 12 | 30,000 | $2,160 | Consider Higgs | +8% | Evaluate migration |
| Month 18 | 75,000 | $5,400 | **Higgs Audio** | +80% | High margin |
| Month 24 | 150,000 | $10,800 | Higgs Audio | +85% | Scaling |
| Year 3 | 500,000 | $36,000 | Higgs Audio | +87% | Mature |

---

## 9. Break-Even Analysis

### Break-Even Point (Hybrid Free Tier)

| Metric | Value |
|--------|-------|
| Downloads needed | ~8,000 |
| Paying users needed | ~48 |
| Monthly revenue at break-even | $575 |
| Monthly costs at break-even | $575 |

### Investment to Profitability

| Phase | Duration | Investment |
|-------|----------|------------|
| Development | 0-3 months | $5,000-10,000 |
| Launch losses | 3-6 months | $700-2,000 |
| **Total runway** | | **$6,000-12,000** |

### Sensitivity Analysis

| Variable | -20% | Base | +20% |
|----------|------|------|------|
| Conversion rate (0.6%) | 10,000 DL | 8,000 DL | 6,700 DL |
| ARPU ($11.99) | 9,600 DL | 8,000 DL | 6,800 DL |
| TTS costs | 7,200 DL | 8,000 DL | 9,000 DL |

### TTS Provider Impact on Break-Even

| TTS Provider | Break-even Downloads | Monthly Cost at Scale |
|--------------|---------------------|----------------------|
| Gemini 2.5 Pro (Hybrid) | 8,000 | $6,500 (at 100K DL) |
| Higgs Audio | 5,000 | $1,300 (at 100K DL) |

---

## 10. Utilization Monitoring

### Why Monitor Utilization?

Subscription pricing assumes users consume **less than their allocation**. Industry standard is to price at expected usage (30-50%) plus a buffer, not at maximum usage. If average utilization exceeds expectations, margins erode.

### Utilization Zones

| Zone | Avg Usage | Action |
|------|-----------|--------|
| **Green** | <60% | Healthy margins, no action needed |
| **Yellow** | 60-80% | Monitor closely, prepare contingency pricing |
| **Red** | >80% | Consider price increase or episode reduction |

### Starter Tier ($9.99 / 30 episodes)

| Avg Usage | Episodes Used | TTS Cost | Revenue | Margin | Zone |
|-----------|---------------|----------|---------|--------|------|
| 30% | 9 | $3.24 | $9.99 | **+$6.75** | Green |
| 50% | 15 | $5.40 | $9.99 | **+$4.59** | Green |
| 60% | 18 | $6.48 | $9.99 | **+$3.51** | Yellow |
| 70% | 21 | $7.56 | $9.99 | **+$2.43** | Yellow |
| 80% | 24 | $8.64 | $9.99 | **+$1.35** | Red |
| 90% | 27 | $9.72 | $9.99 | **+$0.27** | Red |
| 100% | 30 | $10.80 | $9.99 | **-$0.81** | Red |

*TTS Cost = Episodes × $0.36 (Gemini Pro)*

### Pro Tier ($24.99 / 100 episodes)

| Avg Usage | Episodes Used | TTS Cost | Revenue | Margin | Zone |
|-----------|---------------|----------|---------|--------|------|
| 30% | 30 | $10.80 | $24.99 | **+$14.19** | Green |
| 50% | 50 | $18.00 | $24.99 | **+$6.99** | Green |
| 60% | 60 | $21.60 | $24.99 | **+$3.39** | Yellow |
| 70% | 70 | $25.20 | $24.99 | **-$0.21** | Yellow |
| 80% | 80 | $28.80 | $24.99 | **-$3.81** | Red |
| 100% | 100 | $36.00 | $24.99 | **-$11.01** | Red |

*Pro tier is more sensitive to high-usage users*

### Tracking Formulas

```
Avg Utilization = Total Episodes Generated / (Paying Users × Episode Allocation)
Starter Utilization = Starter Episodes / (Starter Users × 30)
Pro Utilization = Pro Episodes / (Pro Users × 100)
```

### Action Triggers

| Trigger | Threshold | Response Options |
|---------|-----------|------------------|
| Single tier enters Yellow | 60%+ for 2 months | Analyze user cohorts, identify power users |
| Both tiers enter Yellow | 60%+ for 1 month | Plan pricing adjustment or allocation change |
| Any tier enters Red | 80%+ for 1 month | Implement price increase or reduce allocation |
| Persistent Red zone | 80%+ for 3 months | Mandatory pricing revision |

### Healthy Margin Targets

| Tier | Expected Usage | Expected Margin | Break-even Usage |
|------|----------------|-----------------|------------------|
| Starter | 40-50% | $4-5/user/month | 92% |
| Pro | 30-40% | $10-12/user/month | 69% |

### Monitoring Dashboard (Recommended Metrics)

Track these monthly:
1. **Avg episodes per Starter user** (target: 12-15)
2. **Avg episodes per Pro user** (target: 30-40)
3. **% of users hitting allocation cap** (target: <10%)
4. **TTS cost per paying user** (target: <60% of subscription price)
5. **Utilization trend** (month-over-month change)

---

## 11. Recommendations

### Immediate Actions

1. **Implement Hybrid Pricing Model**
   - Free: 3 episodes/month (1 Gemini Pro + 2 Standard)
   - Starter: 30 episodes/month, Gemini 2.5 Pro (multi-speaker)
   - Pro: 100 episodes/month, Gemini 2.5 Pro (multi-speaker)

2. **Use Gemini 2.5 Pro TTS** for paid tiers
   - Native multi-speaker dialogue
   - Podcast-optimized output
   - Natural language style prompts
   - Non-verbal cues ([sigh], [laugh])

3. **Episode Length Strategy**
   - MVP: 5-10 minutes (within Gemini's 11-min limit)
   - Post-MVP: Chunked episodes for 11-30+ minutes

4. **Leverage AWS Free Tier**
   - ~$1,400 savings in Year 1
   - Delays infrastructure investment

### Growth Phase (Post-MVP)

5. **Implement Add-Ons** when you have 10K+ downloads
   - Extended episodes (11-30 min, $1.49-$1.99)
   - Long-form episodes (45-90 min, $2.99-$4.99)
   - Priority processing ($0.99)

6. **Evaluate Higgs Audio Migration** at 10K+ episodes/month
   - Self-hosted on cloud GPU (RunPod/Vast.ai)
   - 10-15x TTS cost reduction
   - Requires DevOps investment

### Scale Phase

7. **Migrate to Higgs Audio** at 25K+ episodes/month
   - GPU cost: ~$0.02/episode vs $0.32/episode
   - Margin improvement: 14% → 85%
   - Consider owned GPU at 100K+ episodes/month

8. **Reserved Instances** for predictable workloads
   - 30-40% savings on RDS/ElastiCache

9. **Fargate Spot** for AI workers
   - Up to 70% savings
   - Workers are interrupt-tolerant

---

## Appendix: Cost Formulas

### Revenue Calculation
```
Monthly Revenue = Paying Users × Avg Revenue Per User
Paying Users = Downloads × 0.006 (0.6% conversion)
Avg Revenue = ($9.99 × 0.8) + ($24.99 × 0.2) = $11.99
```

### Episode Cost Calculation
```
Free Standard Episode = $0.06 (Standard TTS) + $0.003 (LLM) + $0.04 (CDN) = $0.10
Free Pro Episode = $0.32 (Gemini Pro TTS) + $0.003 (LLM) + $0.04 (CDN) = $0.36
Paid Episode = $0.32 (Gemini Pro TTS) + $0.003 (LLM) + $0.04 (CDN) = $0.36
Higgs Episode = $0.02 (Self-hosted) + $0.003 (LLM) + $0.04 (CDN) = $0.06

Free User Cost (max 3 eps) = 1×$0.36 + 2×$0.10 = $0.56/user/month
Free User Cost (realistic 1.5 eps) = 0.5×$0.36 + 1×$0.10 = $0.28/user/month
```

### Gemini 2.5 Pro TTS Cost Calculation
```
Audio Tokens = Episode Duration (sec) × 25 tokens/sec
TTS Cost = (Input Tokens × $1/1M) + (Audio Tokens × $20/1M)

Example (10-min episode):
- Audio Tokens = 600 sec × 25 = 15,000 tokens
- Cost = (15,000 × $1/1M) + (15,000 × $20/1M) = $0.015 + $0.30 = $0.315 ≈ $0.32
```

### Total Monthly Cost
```
Total Cost = Infrastructure + Free Tier Cost + Paid Tier Cost

Free Tier Cost = Free Users × $0.28 (realistic hybrid: 0.5 Pro + 1 Std)
Paid Tier Cost = Paid Episodes × $0.36

Where:
- Free Users = Downloads × 0.114 (11.4%)
- Paying Users = Downloads × 0.006 (0.6%)
- Paid Episodes = Paying Users × 15 (avg)
```

### Margin Calculation
```
Margin = (Revenue - Total Cost) / Revenue × 100
```

### Higgs Audio Migration ROI
```
Monthly Savings = (Gemini Cost - Higgs Cost) - DevOps Overhead
Break-even (migration) = Migration Investment / Monthly Savings
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2025 | Initial comprehensive pricing strategy |
| 1.1 | Jan 2025 | Updated episode length to 5-30 min, voice accents to 6, added Google Cloud TTS details |
| 1.2 | Jan 2025 | Marked add-ons and extended episodes (45-90 min) as post-MVP features |
| 2.0 | Jan 2025 | **Major TTS update:** Switched from Neural2 to Gemini 2.5 Pro TTS. Added Higgs Audio as scaling path. Updated costs, break-even analysis, and recommendations. Episode length capped at 10 min for MVP due to Gemini limit. |
| 2.1 | Jan 2025 | **Hybrid free tier:** Changed free tier from 3 Standard to 1 Gemini Pro + 2 Standard. Updated break-even to ~8,000 downloads. Added realistic usage assumptions (50% utilization). |
| 2.2 | Jan 2025 | **Utilization monitoring:** Added Section 10 with utilization zones (Green/Yellow/Red), margin tables by tier, tracking formulas, action triggers, and monitoring dashboard metrics. |

---

*This document should be reviewed quarterly and updated based on actual conversion rates, costs, and market conditions.*
