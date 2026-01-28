# Subscriptions Module

Handles subscriptions using Stripe Checkout and Customer Portal.

## Overview

Based on [PRICING_STRATEGY.md](/docs/PRICING_STRATEGY.md):

| Plan | Price | Episodes/month | Voice Quality |
|------|-------|----------------|---------------|
| **Free** | $0 | 3 (1 Gemini + 2 Standard) | Hybrid |
| **Starter** | $9.99 | 30 | Gemini Pro |
| **Pro** | $24.99 | 100 | Gemini Pro |

- **Payment**: Stripe Checkout for purchases, Customer Portal for management

## Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...          # Stripe API secret key
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook signing secret
STRIPE_PRICE_ID_STARTER=price_...      # Starter tier price ID ($9.99/month)
STRIPE_PRICE_ID_PRO=price_...          # Pro tier price ID ($24.99/month)
MOBILE_APP_SCHEME=auditure             # Deep link scheme for mobile app
APP_URL=https://api.auditure.com       # API base URL for redirects
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/subscriptions/status` | JWT | Get current subscription status |
| POST | `/subscriptions/checkout` | JWT | Create Stripe Checkout session |
| POST | `/subscriptions/portal` | JWT | Create Customer Portal session |
| POST | `/subscriptions/webhook` | None | Handle Stripe webhooks |
| GET | `/subscriptions/success` | None | Checkout success redirect |
| GET | `/subscriptions/cancel` | None | Checkout cancel redirect |

### POST /subscriptions/checkout

Creates a Stripe Checkout session for subscription purchase.

**Request:**
```json
{
  "tier": "starter" | "pro"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### POST /subscriptions/portal

Creates a Stripe Customer Portal session for subscription management.

**Request:**
```json
{
  "returnUrl": "auditure://subscription"  // optional
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

### GET /subscriptions/status

Returns current subscription status with usage information.

**Response:**
```json
{
  "tier": "FREE" | "STARTER" | "PRO",
  "isPaid": false,
  "premiumStartedAt": null,
  "premiumExpiresAt": null,
  "stripeSubscription": {
    "status": "active",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  },
  "usage": {
    "geminiEpisodesUsed": 1,
    "standardEpisodesUsed": 2,
    "geminiEpisodeLimit": 1,
    "standardEpisodeLimit": 2
  }
}
```

**Episode Limits by Tier:**
| Tier | Gemini Limit | Standard Limit |
|------|--------------|----------------|
| FREE | 1 | 2 |
| STARTER | 30 | 30 |
| PRO | 100 | 100 |

## Stripe Dashboard Setup

### 1. Create Products

1. Go to **Products** → **Add Product**

**Starter Plan:**
- Name: `Auditure Starter`
- Description: `30 episodes per month with Gemini Pro voice quality`
- Price: $9.99/month, recurring
- Copy the Price ID → `STRIPE_PRICE_ID_STARTER`

**Pro Plan:**
- Name: `Auditure Pro`
- Description: `100 episodes per month with priority generation`
- Price: $24.99/month, recurring
- Copy the Price ID → `STRIPE_PRICE_ID_PRO`

### 2. Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Enable:
   - Update payment method
   - Cancel subscription
   - View invoices
3. Set cancellation to "Cancel at end of billing period"

### 3. Set Up Webhooks

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. URL: `https://your-api.com/subscriptions/webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the signing secret

## Webhook Events

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Set tier to STARTER/PRO based on price, update limits |
| `customer.subscription.updated` | Update expiration date, handle status changes |
| `customer.subscription.deleted` | Downgrade to FREE, reset limits to 1 Gemini + 2 Standard |
| `invoice.payment_failed` | Send notification to user |
| `invoice.payment_succeeded` | Update expiration date, send renewal notification |

**Tier Determination:**
The tier is determined from subscription metadata (`tier: 'starter' | 'pro'`) set during checkout, or by matching the Stripe price ID to environment variables.

## Local Testing

### Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (scoop)
scoop install stripe
```

### Forward Webhooks

```bash
# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/subscriptions/webhook

# Copy the webhook signing secret (whsec_...) to your .env
```

### Trigger Test Events

```bash
stripe trigger customer.subscription.created
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

### Test Card Numbers

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |

## Module Structure

```
subscriptions/
├── subscriptions.module.ts           # Module definition
├── subscriptions.service.ts          # Business logic & webhook handlers
├── subscriptions.controller.ts       # API endpoints
├── subscriptions-webhook.controller.ts # Webhook endpoint
├── stripe.service.ts                 # Stripe SDK wrapper
├── dto/
│   ├── create-checkout-session.dto.ts
│   └── create-portal-session.dto.ts
└── README.md
```

## Security

- Webhook signature verification using raw request body
- JWT authentication on all user-facing endpoints
- Stripe customer ID linked to user via metadata
- Secret keys stored in environment variables only
