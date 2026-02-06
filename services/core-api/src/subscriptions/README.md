# Subscriptions Module

Handles subscriptions using Paystack for payments. Paystack is ideal for African markets including South Africa, with support for international cards.

> **Note**: MVP uses Paystack. Stripe integration planned for scale.

## Overview

Based on [PRICING_STRATEGY.md](/docs/PRICING_STRATEGY.md):

| Plan | Price | Episodes/month | Max Duration | Voice Quality |
|------|-------|----------------|--------------|---------------|
| **Free** | $0 | 3 (1 Gemini + 2 Standard) | 10 min | Hybrid |
| **Starter** | $9.99 | 20 (unified) | 30 min | Gemini Pro |
| **Pro** | $24.99 | 50 (unified) | 30 min | Gemini Pro |

- **Payment**: Paystack Checkout for purchases
- **Management**: Via email links from Paystack or in-app cancellation/reactivation

## Subscription Lifecycle

Paystack subscriptions follow this state machine:

```
                    User subscribes
                         │
                         ▼
                    ┌──────────┐
           ┌──────▶│  active   │◀─────────────────┐
           │       └────┬─────┘                    │
           │            │                          │
           │       User cancels                    │
           │       (disable API)              Re-enable API
           │            │                     (non-renewing only)
           │            ▼                          │
           │    ┌───────────────┐                  │
           │    │ non-renewing  │──────────────────┘
           │    └───────┬───────┘
           │            │
           │    Billing period ends
           │            │
           │            ▼
           │    ┌───────────────┐
           │    │  cancelled    │
           │    └───────┬───────┘
           │            │
           │    New checkout (re-charge)
           └────────────┘
```

**Key behaviors:**
- **Cancel** = Paystack `disable` API → sets subscription to `non-renewing`
- **Non-renewing** subscriptions remain active until billing period ends, then become `cancelled`
- **Re-enable** works only on `non-renewing` subscriptions (not `cancelled`)
- Once `cancelled`, the user must go through checkout again (new charge)
- Paystack allows **multiple active subscriptions** per customer — the app enforces single-subscription logic
- Paystack has **no force-cancel** — disable only sets to non-renewing; must wait for billing period to end

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
| POST | `/subscriptions/checkout` | JWT | Initialize Paystack transaction (or re-enable) |
| POST | `/subscriptions/manage` | JWT | Get subscription management info |
| POST | `/subscriptions/cancel` | JWT | Cancel subscription (sets to non-renewing) |
| POST | `/subscriptions/reactivate` | JWT | Re-enable a cancelled/non-renewing subscription |
| POST | `/subscriptions/cleanup-duplicates` | JWT | Clean up duplicate Paystack subscriptions |
| POST | `/subscriptions/webhook` | None | Handle Paystack webhooks |
| GET | `/subscriptions/callback` | None | Payment callback handler (HTML redirect page) |
| GET | `/subscriptions/success` | None | Success redirect (deep link) |
| GET | `/subscriptions/cancel-redirect` | None | Cancel redirect (deep link) |

### GET /subscriptions/status

Returns current subscription status with Paystack state and usage information.

If the Paystack subscription has a non-active/non-renewing status (e.g., `cancelled`, `complete`), the service automatically clears the stored Paystack codes from the DB and marks the subscription as cancelled.

**Response:**
```json
{
  "tier": "FREE" | "STARTER" | "PRO",
  "isPaid": false,
  "isCancelled": false,
  "premiumStartedAt": null,
  "premiumExpiresAt": null,
  "paystackSubscription": {
    "status": "active" | "non-renewing",
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
| Tier | Model | Limit |
|------|-------|-------|
| FREE | Separate: 1 Gemini + 2 Standard | 3 total |
| STARTER | Unified (any type) | 20 total |
| PRO | Unified (any type) | 50 total |

### POST /subscriptions/checkout

Initializes a Paystack transaction for subscription purchase. Includes a smart re-enable fallback: if the user's DB codes were cleared but they have a `non-renewing` subscription on Paystack for the same plan, it attempts to re-enable it first (avoiding a double charge). Falls back to new checkout if re-enable fails.

**Request:**
```json
{
  "tier": "starter" | "pro",
  "isUpgrade": false
}
```

- `isUpgrade` (optional, default `false`): Set to `true` when switching from Starter to Pro. This cancels the old subscription before creating the new one.

**Response (new checkout):**
```json
{
  "reference": "txn_ref_123...",
  "accessCode": "access_code_123...",
  "url": "https://checkout.paystack.com/..."
}
```

**Response (re-enabled existing subscription):**
```json
{
  "reEnabled": true,
  "message": "Your subscription has been re-activated! You will be billed on your regular billing date."
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

Cancels the active subscription via Paystack's `disable` API. The subscription moves to `non-renewing` and remains active until the billing period ends.

**Response:**
```json
{
  "success": true,
  "message": "Subscription will be cancelled at the end of the billing period."
}
```

### POST /subscriptions/reactivate

Re-enables a `non-renewing` subscription (one that was cancelled but billing period hasn't ended). Uses Paystack's `enable` API.

If the subscription has already fully `cancelled` on Paystack (billing period ended), this clears the stored codes and `premiumStartedAt` from the DB, and returns an error prompting the user to subscribe again via checkout.

**Response (success):**
```json
{
  "success": true,
  "message": "Subscription reactivated successfully."
}
```

**Response (cannot reactivate):**
```json
{
  "statusCode": 400,
  "message": "This subscription cannot be reactivated. Please subscribe again to continue."
}
```

### POST /subscriptions/cleanup-duplicates

Cleans up duplicate Paystack subscriptions for the user. Since Paystack allows multiple subscriptions per customer and each new checkout creates a new subscription, duplicates can accumulate. This endpoint disables any `active` or `non-renewing` subscriptions that don't match the user's current subscription code.

**Response:**
```json
{
  "cleaned": 2,
  "message": "Cleaned up 2 duplicate subscriptions."
}
```

### GET /subscriptions/callback

Payment callback handler that Paystack redirects to after checkout. Verifies the transaction and renders an HTML page that:
1. Attempts an automatic deep link redirect to the mobile app
2. Shows a "Return to Auditure" button as fallback
3. Displays payment status (success/failed/error)

### GET /subscriptions/success

Simple redirect to the mobile app deep link with `status=success`.

### GET /subscriptions/cancel-redirect

Simple redirect to the mobile app deep link with `status=cancelled`.

## Re-Enable Strategy

When a user resubscribes to the same plan, the service uses a 3-tier strategy to avoid unnecessary charges:

1. **Fast path (reactivate endpoint)**: If DB has Paystack codes, use `enable` API directly
2. **Fallback (checkout endpoint)**: If DB codes were cleared, query Paystack for `non-renewing` subscriptions matching the plan and attempt re-enable
3. **New checkout (last resort)**: If no re-enableable subscription exists, create a new Paystack checkout session

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

### Known Test Mode Limitations

- **Re-enable endpoint**: Paystack's `enable` API may refuse to re-enable `non-renewing` subscriptions in test mode, even though the docs confirm this should work. The fallback to new checkout handles this gracefully. Re-enable works in production.

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
| Customer Portal | No (email links) | Built-in |
| Subscription Management | Via API/Email | Customer Portal |
| Retry on Failed Payment | No | Automatic |
| Webhook Signature | HMAC SHA512 | Stripe signing secret |
| Settlement Currency | ZAR (SA) | Multiple currencies |
| Cancel Behavior | Non-renewing until period ends | Configurable |
| Multiple Active Subs | Allowed per customer | Configurable |

## Future: Stripe at Scale

When ready to expand globally with USD settlements:
1. Set up Stripe Atlas for US entity
2. Implement parallel Stripe integration
3. Route users based on location/preference
