import { resolveEffectiveTier, TierResolutionInput } from './tier-resolution';

describe('resolveEffectiveTier', () => {
    const now = new Date('2026-04-23T12:00:00Z');
    const future = new Date('2026-05-23T12:00:00Z');
    const past = new Date('2026-03-23T12:00:00Z');

    const freeSub = (overrides: Partial<TierResolutionInput> = {}): TierResolutionInput => ({
        tier: 'FREE',
        premiumExpiresAt: null,
        compExpiresAt: null,
        compReason: null,
        ...overrides,
    });

    it('returns FREE when subscription is null', () => {
        expect(resolveEffectiveTier(null, now)).toEqual({ source: 'none', tier: 'FREE' });
    });

    it('returns FREE for a plain FREE subscription', () => {
        expect(resolveEffectiveTier(freeSub(), now)).toEqual({ source: 'none', tier: 'FREE' });
    });

    it('returns paid PRO when premium is active', () => {
        const result = resolveEffectiveTier(
            freeSub({ tier: 'PRO', premiumExpiresAt: future }),
            now,
        );
        expect(result).toEqual({ source: 'paid', tier: 'PRO', expiresAt: future });
    });

    it('returns paid STARTER when premium is active', () => {
        const result = resolveEffectiveTier(
            freeSub({ tier: 'STARTER', premiumExpiresAt: future }),
            now,
        );
        expect(result).toEqual({ source: 'paid', tier: 'STARTER', expiresAt: future });
    });

    it('returns FREE when paid tier has expired and no comp', () => {
        const result = resolveEffectiveTier(
            freeSub({ tier: 'PRO', premiumExpiresAt: past }),
            now,
        );
        expect(result).toEqual({ source: 'none', tier: 'FREE' });
    });

    it('returns comp PRO when comp is active (no paid)', () => {
        const result = resolveEffectiveTier(
            freeSub({
                tier: 'PRO',
                compExpiresAt: future,
                compReason: 'influencer:@jane',
            }),
            now,
        );
        expect(result).toEqual({
            source: 'comp',
            tier: 'PRO',
            expiresAt: future,
            reason: 'influencer:@jane',
        });
    });

    it('prefers paid over comp when both are active', () => {
        const paidExpiry = new Date('2026-05-15T12:00:00Z');
        const compExpiry = new Date('2026-06-15T12:00:00Z');
        const result = resolveEffectiveTier(
            freeSub({
                tier: 'PRO',
                premiumExpiresAt: paidExpiry,
                compExpiresAt: compExpiry,
                compReason: 'influencer:@jane',
            }),
            now,
        );
        expect(result).toEqual({ source: 'paid', tier: 'PRO', expiresAt: paidExpiry });
    });

    it('falls back to comp when paid has expired but comp is still active', () => {
        const result = resolveEffectiveTier(
            freeSub({
                tier: 'PRO',
                premiumExpiresAt: past,
                compExpiresAt: future,
                compReason: 'press',
            }),
            now,
        );
        expect(result).toEqual({
            source: 'comp',
            tier: 'PRO',
            expiresAt: future,
            reason: 'press',
        });
    });

    it('returns FREE when both paid and comp are expired', () => {
        const olderPast = new Date('2026-02-23T12:00:00Z');
        const result = resolveEffectiveTier(
            freeSub({
                tier: 'PRO',
                premiumExpiresAt: past,
                compExpiresAt: olderPast,
            }),
            now,
        );
        expect(result).toEqual({ source: 'none', tier: 'FREE' });
    });

    it('treats tier FREE with active comp as comp PRO (upgrade path)', () => {
        // A user never paid, just got comped. Their tier field may still be FREE
        // until the grant writes PRO — helper should resolve comp independently.
        const result = resolveEffectiveTier(
            freeSub({ compExpiresAt: future, compReason: 'influencer:@jane' }),
            now,
        );
        expect(result).toEqual({
            source: 'comp',
            tier: 'PRO',
            expiresAt: future,
            reason: 'influencer:@jane',
        });
    });

    it('ignores paystackSubscriptionCode — not part of tier resolution', () => {
        // A paid user with non-renewing sub (still within billing period) is still paid.
        // Paystack code presence is a UI concern (show cancel button), not a tier concern.
        const result = resolveEffectiveTier(
            freeSub({ tier: 'PRO', premiumExpiresAt: future }),
            now,
        );
        expect(result.source).toBe('paid');
    });

    it('treats null compReason on active comp as null (not undefined)', () => {
        const result = resolveEffectiveTier(
            freeSub({ compExpiresAt: future, compReason: null }),
            now,
        );
        expect(result).toEqual({
            source: 'comp',
            tier: 'PRO',
            expiresAt: future,
            reason: null,
        });
    });
});
