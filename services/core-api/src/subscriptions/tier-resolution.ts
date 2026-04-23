/**
 * Pure tier resolution logic.
 *
 * A user's effective access can come from two independent sources:
 *   - paid: Paystack subscription, billed monthly, tracked via premiumExpiresAt
 *   - comp: manually granted (influencer outreach, press), tracked via compExpiresAt
 *
 * Precedence: paid wins over comp when both are active. A user who converts
 * mid-comp should be governed by their billing, not leftover comp state.
 */

export type SubscriptionTier = 'FREE' | 'STARTER' | 'PRO';

export type TierResolution =
    | { source: 'none'; tier: 'FREE' }
    | {
          source: 'paid';
          tier: 'STARTER' | 'PRO';
          expiresAt: Date;
      }
    | {
          source: 'comp';
          tier: 'PRO';
          expiresAt: Date;
          reason: string | null;
      };

export interface TierResolutionInput {
    tier: SubscriptionTier;
    premiumExpiresAt: Date | null;
    compExpiresAt: Date | null;
    compReason: string | null;
}

/**
 * Resolve the effective tier for a subscription at a given point in time.
 * Pure function — no side effects. Callers handle any DB mutations (e.g.
 * auto-downgrade when paid/comp expires).
 */
export function resolveEffectiveTier(
    subscription: TierResolutionInput | null,
    now: Date = new Date(),
): TierResolution {
    if (!subscription) {
        return { source: 'none', tier: 'FREE' };
    }

    const paidActive =
        (subscription.tier === 'STARTER' || subscription.tier === 'PRO') &&
        subscription.premiumExpiresAt !== null &&
        subscription.premiumExpiresAt > now;

    if (paidActive) {
        return {
            source: 'paid',
            tier: subscription.tier as 'STARTER' | 'PRO',
            expiresAt: subscription.premiumExpiresAt!,
        };
    }

    const compActive =
        subscription.compExpiresAt !== null && subscription.compExpiresAt > now;

    if (compActive) {
        return {
            source: 'comp',
            tier: 'PRO',
            expiresAt: subscription.compExpiresAt!,
            reason: subscription.compReason,
        };
    }

    return { source: 'none', tier: 'FREE' };
}
