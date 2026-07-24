# Subscriptions Module

Handles subscription tiers and usage limits. Billing runs through **RevenueCat + Google Play Billing**. Purchases and cancellations happen entirely in-app via the RevenueCat SDK; this backend reacts to **RevenueCat webhooks** to keep each user's tier and episode limits in sync.

> **Migration note:** This module previously used Paystack. Paystack is being retired. No real Paystack subscribers ever existed. The Paystack service and the legacy mutation endpoints remain only so pre-migration app builds get a graceful "update the app" message instead of a broken flow. New builds never call them.

## Overview

| Plan | Price | Episodes/month | Max Duration | Voice |
|------|-------|----------------|--------------|-------|
| **Free** | $0 | 3 (1 Gemini + 2 Standard) | 10 min | Hybrid |
| **Starter** | $9.99 | 20 (unified) | 30 min | Gemini |
| **Pro** | $24.99 | 50 (unified) | 30 min | Gemini |

- **Payment & management:** Google Play Billing via the RevenueCat SDK, in-app.
- **Backend role:** Consume RC webhooks, resolve the effective tier, update limits.

## Tier Resolution

A user's effective access can come from two independent sources (`tier-resolution.ts`):

- **paid** — an active Google Play subscription (via RevenueCat), tracked by `premiumExpiresAt`.
- **comp** — complimentary PRO access granted manually (influencer outreach, press), tracked by `compExpiresAt` / `compReason`.

**Precedence:** `paid` > `comp` > `free`. A user who converts to paid mid-comp is governed by their billing, not leftover comp state. `resolveEffectiveTier()` is a pure function; callers handle any DB mutations (such as auto-downgrade when access expires).

## RevenueCat Webhook

**Endpoint:** `POST /subscriptions/rc-webhook` (`revenuecat-webhook.controller.ts`)

Not behind `JwtAuthGuard` — RevenueCat calls it directly. Authenticated by comparing the incoming `Authorization` header against `REVENUECAT_WEBHOOK_AUTH_HEADER`. Bad auth or malformed body returns 4xx; transient processing errors are swallowed and return 200 so RC does not retry forever (failures still surface in logs and Sentry, and RC keeps event history for replay).

### Product → Tier Mapping

| RevenueCat product ID | Tier |
|-----------------------|------|
| `auditure_premium:starter` | STARTER |
| `auditure_premium:pro` | PRO |

### Tier Limits

| Tier | Gemini | Standard |
|------|--------|----------|
| FREE | 1 | 2 |
| STARTER | 20 | 20 |
| PRO | 50 | 50 |

### Handled Events (`revenuecat.service.ts`)

| RC Event | Action |
|----------|--------|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` | Activate subscription: set tier, `premiumStartedAt`/`premiumExpiresAt`, and limits |
| `PRODUCT_CHANGE` | Re-activate with the new product's tier (e.g. Starter → Pro) |
| `CANCELLATION` | Mark `cancelledAt`; access continues until `premiumExpiresAt` |
| `EXPIRATION` | Downgrade to FREE, reset limits and usage counters |
| `BILLING_ISSUE` | Log only (expiry is handled by the later `EXPIRATION` event) |
| `NON_RENEWING_PURCHASE`, `SUBSCRIBER_ALIAS`, `TRANSFER`, `TEST` | No-op |

The RC `app_user_id` is the Auditure user ID. If no `Subscription` row exists for that user, the event is ignored with a warning.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/subscriptions/status` | JWT | Current tier, cancellation state, and usage |
| POST | `/subscriptions/rc-webhook` | RC header | RevenueCat webhook handler |

### GET /subscriptions/status

Returns the effective tier (resolving paid/comp/free), cancellation state, and current usage against the tier limits.

```json
{
  "tier": "FREE" | "STARTER" | "PRO",
  "isPaid": false,
  "isCancelled": false,
  "premiumStartedAt": null,
  "premiumExpiresAt": null,
  "usage": {
    "geminiEpisodesUsed": 1,
    "standardEpisodesUsed": 2,
    "geminiEpisodeLimit": 1,
    "standardEpisodeLimit": 2
  }
}
```

**Episode limits by tier:**
| Tier | Model | Limit |
|------|-------|-------|
| FREE | Separate: 1 Gemini + 2 Standard | 3 total |
| STARTER | Unified (any type) | 20 total |
| PRO | Unified (any type) | 50 total |

## Legacy Paystack Endpoints (retiring)

These remain only for backward compatibility with pre-migration app builds. Each mutation endpoint returns a `400` with the message *"Please update Auditure to the latest version to manage your subscription."* Remove them once the RC-enabled build is the minimum supported version.

| Method | Endpoint | Behavior |
|--------|----------|----------|
| POST | `/subscriptions/checkout` | Legacy stub → update-app notice |
| POST | `/subscriptions/manage` | Legacy stub → update-app notice |
| POST | `/subscriptions/cancel` | Legacy stub → update-app notice |
| POST | `/subscriptions/reactivate` | Legacy stub → update-app notice |
| POST | `/subscriptions/cleanup-duplicates` | Legacy stub → update-app notice |
| GET | `/subscriptions/callback` | Paystack redirect handler (HTML deep-link page) |
| GET | `/subscriptions/success`, `/subscriptions/cancel-redirect` | Deep-link redirects |
| POST | `/subscriptions/webhook` | Paystack webhook (HMAC SHA512 verification) |

`paystack.service.ts` and `subscriptions-webhook.controller.ts` are kept for these routes only.

## Environment Variables

```env
# RevenueCat (active)
REVENUECAT_WEBHOOK_AUTH_HEADER=...    # static Authorization header value set in the RC dashboard

# Deep-link scheme (used by legacy callback pages)
MOBILE_APP_SCHEME=auditure

# Paystack (legacy — retiring)
PAYSTACK_SECRET_KEY=sk_...
PAYSTACK_PUBLIC_KEY=pk_...
PAYSTACK_PLAN_CODE_STARTER=PLN_...
PAYSTACK_PLAN_CODE_PRO=PLN_...
```

## Module Structure

```
subscriptions/
├── subscriptions.module.ts               # Module definition
├── subscriptions.controller.ts           # /status + legacy Paystack stubs & redirects
├── subscriptions.service.ts              # Status, usage, tier logic, Paystack callback (legacy)
├── revenuecat-webhook.controller.ts      # POST /subscriptions/rc-webhook
├── revenuecat.service.ts                 # RC event handling → tier/limits
├── tier-resolution.ts                    # Pure paid/comp/free resolution
├── tier-resolution.spec.ts
├── paystack.service.ts                   # Legacy Paystack API wrapper
├── paystack-webhook-security.spec.ts     # Legacy webhook signature tests
├── subscriptions-webhook.controller.ts   # Legacy Paystack webhook endpoint
├── dto/
└── README.md
```

## Security

- RevenueCat webhook authenticated via a static header secret (`REVENUECAT_WEBHOOK_AUTH_HEADER`).
- JWT authentication on user-facing endpoints (`/status`).
- Legacy Paystack webhook verifies HMAC SHA512 signatures with raw-body handling.
- All secrets stored in environment variables / GCP Secret Manager only.
