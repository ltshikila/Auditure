# Subscriptions Module

Handles subscriptions using Paystack for payments. Paystack is ideal for African markets including South Africa, with support for international cards.

> **Note**: MVP uses Paystack. Stripe integration planned for scale.

## Overview

Based on [PRICING_STRATEGY.md](/docs/PRICING_STRATEGY.md):

| Plan | Price | Episodes/month | Voice Quality |
|------|-------|----------------|---------------|
| **Free** | $0 | 3 (1 Gemini + 2 Standard) | Hybrid |
| **Starter** | $9.99 | 30 | Gemini Pro |
| **Pro** | $24.99 | 100 | Gemini Pro |

- **Payment**: Paystack Checkout for purchases
- **Management**: Via email links from Paystack or in-app cancellation

## Environment Variables

```env
PAYSTACK_SECRET_KEY=sk_test_...       # Paystack API secret key
PAYSTACK_PUBLIC_KEY=pk_test_...       # Paystack API public key
PAYSTACK_PLAN_CODE_STARTER=PLN_...    # Starter tier plan code
PAYSTACK_PLAN_CODE_PRO=PLN_...        # Pro tier plan code
MOBILE_APP_SCHEME=auditure            # Deep link scheme for mobile app
APP_URL=https://api.auditure.com      # API base URL for callbacks
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/subscriptions/status` | JWT | Get current subscription status |
| POST | `/subscriptions/checkout` | JWT | Initialize Paystack transaction |
| POST | `/subscriptions/manage` | JWT | Get subscription management info |
| POST | `/subscriptions/cancel` | JWT | Cancel subscription |
| POST | `/subscriptions/webhook` | None | Handle Paystack webhooks |
| GET | `/subscriptions/callback` | None | Payment callback handler |
| GET | `/subscriptions/success` | None | Success redirect |

### POST /subscriptions/checkout

Initializes a Paystack transaction for subscription purchase.

**Request:**
```json
{
  "tier": "starter" | "pro"
}
```

**Response:**
```json
{
  "reference": "txn_ref_123...",
  "accessCode": "access_code_123...",
  "url": "https://checkout.paystack.com/..."
}
```

### POST /subscriptions/manage

Returns subscription management information.

**Response:**
```json
{
  "message": "To manage your subscription, please check your email...",
  "subscriptionCode": "SUB_..."
}
```

### POST /subscriptions/cancel

Cancels the active subscription (takes effect at end of billing period).

**Response:**
```json
{
  "success": true,
  "message": "Subscription will be cancelled at the end of the billing period."
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
  "paystackSubscription": {
    "status": "active",
    "nextPaymentDate": "2024-02-01T00:00:00.000Z"
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

## Paystack Dashboard Setup

### 1. Get API Keys

1. Go to [Paystack Dashboard](https://dashboard.paystack.com)
2. Navigate to **Settings** → **API Keys & Webhooks**
3. Copy your **Test Secret Key** and **Test Public Key**

### 2. Create Plans

1. Go to **Payments** → **Plans** → **Create Plan**

**Starter Plan:**
- Name: `Auditure Starter`
- Amount: `999` (ZAR 9.99 in kobo/cents) or equivalent in your currency
- Interval: `Monthly`
- Copy the Plan Code → `PAYSTACK_PLAN_CODE_STARTER`

**Pro Plan:**
- Name: `Auditure Pro`
- Amount: `2499` (ZAR 24.99 in kobo/cents)
- Interval: `Monthly`
- Copy the Plan Code → `PAYSTACK_PLAN_CODE_PRO`

### 3. Set Up Webhooks

1. Go to **Settings** → **API Keys & Webhooks**
2. Add webhook URL: `https://your-api.com/subscriptions/webhook`
3. Paystack automatically sends events, no need to select specific ones

## Webhook Events

| Event | Action |
|-------|--------|
| `charge.success` | Update tier, extend subscription period |
| `subscription.create` | Set tier to STARTER/PRO based on plan, update limits |
| `subscription.not_renew` | Notify user subscription won't renew |
| `subscription.disable` | Downgrade to FREE, reset limits |
| `invoice.payment_failed` | Send notification to user |
| `invoice.create` | Log upcoming charge (sent 3 days before renewal) |

**Tier Determination:**
The tier is determined from the plan code in the subscription data, matched against the environment variables.

## Local Testing

### Using ngrok for webhooks

Since Paystack doesn't have a CLI like Stripe, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3000

# Copy the HTTPS URL and add to Paystack webhook settings
# Example: https://abc123.ngrok.io/subscriptions/webhook
```

### Test Card Numbers

| Card | Result |
|------|--------|
| `4084 0840 8408 4081` | Success |
| `4084 0840 8408 4099` | Failed transaction |

- Expiry: Any future date
- CVV: `408`
- PIN: `0000` (if prompted)
- OTP: `123456` (if prompted)

## Module Structure

```
subscriptions/
├── subscriptions.module.ts              # Module definition
├── subscriptions.service.ts             # Business logic & webhook handlers
├── subscriptions.controller.ts          # API endpoints
├── subscriptions-webhook.controller.ts  # Webhook endpoint
├── paystack.service.ts                  # Paystack API wrapper
├── dto/
│   ├── create-checkout-session.dto.ts
│   └── create-portal-session.dto.ts
└── README.md
```

## Security

- Webhook signature verification using HMAC SHA512
- JWT authentication on all user-facing endpoints
- Paystack customer code linked to user
- Secret keys stored in environment variables only
- Raw request body handling for webhook security

## Differences from Stripe

| Feature | Paystack | Stripe |
|---------|----------|--------|
| Customer Portal | ❌ (email links) | ✅ Built-in |
| Subscription Management | Via API/Email | Customer Portal |
| Retry on Failed Payment | ❌ | ✅ Automatic |
| Webhook Signature | HMAC SHA512 | Stripe signing secret |
| Settlement Currency | ZAR (SA) | Multiple currencies |

## Future: Stripe at Scale

When ready to expand globally with USD settlements:
1. Set up Stripe Atlas for US entity
2. Implement parallel Stripe integration
3. Route users based on location/preference
