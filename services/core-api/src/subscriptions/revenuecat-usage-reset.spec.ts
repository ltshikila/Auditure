import { RevenueCatService } from './revenuecat.service';
import { DatabaseService } from '../database/database.service';
import type { RevenueCatEvent } from './dto/revenuecat-webhook.dto';

// Quota resets are anchored to the billing date. These cases lock in which RC
// events grant a fresh allowance and which must leave the counters alone.
describe('RevenueCatService usage reset', () => {
    const userId = 'user-1';
    const periodStart = new Date('2026-07-02T18:11:16.932Z');
    const renewalAt = new Date('2026-07-29T16:52:13.874Z');
    const expiresAt = new Date('2026-08-29T16:52:13.874Z');

    let update: jest.Mock;
    let service: RevenueCatService;

    const existingSub = (overrides: Record<string, unknown> = {}) => ({
        userId,
        tier: 'STARTER',
        geminiEpisodesUsed: 6,
        standardEpisodesUsed: 0,
        usagePeriodStart: periodStart,
        premiumStartedAt: periodStart,
        premiumExpiresAt: expiresAt,
        ...overrides,
    });

    const setup = (sub: Record<string, unknown> | null) => {
        update = jest.fn().mockResolvedValue({});
        const db = {
            subscription: {
                findUnique: jest.fn().mockResolvedValue(sub),
                update,
            },
        } as unknown as DatabaseService;
        service = new RevenueCatService(db);
    };

    const event = (overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent =>
        ({
            type: 'RENEWAL',
            id: 'evt-1',
            app_user_id: userId,
            product_id: 'auditure_premium:starter',
            purchased_at_ms: renewalAt.getTime(),
            expiration_at_ms: expiresAt.getTime(),
            event_timestamp_ms: renewalAt.getTime(),
            ...overrides,
        }) as RevenueCatEvent;

    const dataOf = () => update.mock.calls[0][0].data;

    it('resets usage and re-anchors the period on RENEWAL', async () => {
        setup(existingSub());
        await service.handleEvent(event());

        expect(dataOf()).toMatchObject({
            geminiEpisodesUsed: 0,
            standardEpisodesUsed: 0,
            usagePeriodStart: renewalAt,
            premiumStartedAt: renewalAt,
        });
    });

    it('resets usage on INITIAL_PURCHASE', async () => {
        setup(existingSub({ tier: 'FREE', geminiEpisodesUsed: 1, standardEpisodesUsed: 2 }));
        await service.handleEvent(event({ type: 'INITIAL_PURCHASE' }));

        expect(dataOf()).toMatchObject({
            tier: 'STARTER',
            geminiEpisodesUsed: 0,
            standardEpisodesUsed: 0,
            usagePeriodStart: renewalAt,
        });
    });

    it('does not reset twice when RevenueCat redelivers the same RENEWAL', async () => {
        // Period already anchored to this payment, and 3 episodes spent since.
        setup(
            existingSub({
                usagePeriodStart: renewalAt,
                premiumStartedAt: renewalAt,
                geminiEpisodesUsed: 3,
            }),
        );
        await service.handleEvent(event());

        const data = dataOf();
        expect(data.geminiEpisodesUsed).toBeUndefined();
        expect(data.standardEpisodesUsed).toBeUndefined();
        expect(data.usagePeriodStart).toBeUndefined();
    });

    it('does not grant a fresh allowance on UNCANCELLATION', async () => {
        setup(existingSub());
        await service.handleEvent(event({ type: 'UNCANCELLATION' }));

        const data = dataOf();
        expect(data.geminiEpisodesUsed).toBeUndefined();
        expect(data.standardEpisodesUsed).toBeUndefined();
        expect(data.cancelledAt).toBeNull();
    });

    it('does not grant a fresh allowance on PRODUCT_CHANGE', async () => {
        setup(existingSub());
        await service.handleEvent(
            event({
                type: 'PRODUCT_CHANGE',
                new_product_id: 'auditure_premium:pro',
            }),
        );

        const data = dataOf();
        expect(data.tier).toBe('PRO');
        expect(data.geminiEpisodeLimit).toBe(50);
        expect(data.geminiEpisodesUsed).toBeUndefined();
        expect(data.standardEpisodesUsed).toBeUndefined();
    });

    it('ignores the event when no subscription row exists', async () => {
        setup(null);
        await service.handleEvent(event());
        expect(update).not.toHaveBeenCalled();
    });
});
