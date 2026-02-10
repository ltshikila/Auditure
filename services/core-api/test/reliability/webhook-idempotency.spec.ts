/**
 * Webhook Idempotency Tests
 *
 * Verifies that subscription webhook handlers in SubscriptionsService are
 * idempotent: processing the same event twice produces the same DB state
 * and does not throw errors.
 *
 * Uses mocked DatabaseService, PaystackService, and NotificationsService.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { DatabaseService } from '../../src/database/database.service';
import { PaystackService } from '../../src/subscriptions/paystack.service';
import { NotificationsService } from '../../src/notifications/notifications.service';

// Reusable mock factory for the subscription DB record
const createMockSubscription = (overrides: Record<string, any> = {}) => ({
    id: 'sub-record-1',
    userId: 'user-123',
    tier: 'STARTER',
    paystackCustomerCode: 'CUS_test123',
    paystackSubscriptionCode: 'SUB_test456',
    paystackEmailToken: 'token-abc',
    premiumStartedAt: new Date('2025-01-01'),
    premiumExpiresAt: new Date('2025-02-01'),
    geminiEpisodesUsed: 0,
    standardEpisodesUsed: 0,
    geminiEpisodeLimit: 20,
    standardEpisodeLimit: 20,
    usagePeriodStart: new Date('2025-01-01'),
    ...overrides,
});

// Mock database service with subscription model
const createMockDatabaseService = () => ({
    subscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
});

const createMockPaystackService = () => ({
    isConfigured: jest.fn().mockReturnValue(true),
    getSubscription: jest.fn(),
    getPlanCode: jest.fn().mockReturnValue('PLN_starter'),
    getAppUrl: jest.fn().mockReturnValue('http://localhost:3000'),
    verifyWebhookSignature: jest.fn(),
    verifyTransaction: jest.fn(),
    createCustomer: jest.fn(),
    initializeTransaction: jest.fn(),
    disableSubscription: jest.fn(),
    enableSubscription: jest.fn(),
    listCustomerSubscriptions: jest.fn(),
});

const createMockNotificationsService = () => ({
    notifySystem: jest.fn().mockResolvedValue(null),
    notifyEpisodeReady: jest.fn().mockResolvedValue(null),
    notifyEpisodeFailed: jest.fn().mockResolvedValue(null),
    notifySubscriptionWarning: jest.fn().mockResolvedValue(null),
});

describe('Webhook Idempotency', () => {
    let service: SubscriptionsService;
    let mockDb: ReturnType<typeof createMockDatabaseService>;
    let mockPaystack: ReturnType<typeof createMockPaystackService>;
    let mockNotifications: ReturnType<typeof createMockNotificationsService>;

    beforeEach(async () => {
        mockDb = createMockDatabaseService();
        mockPaystack = createMockPaystackService();
        mockNotifications = createMockNotificationsService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubscriptionsService,
                { provide: DatabaseService, useValue: mockDb },
                { provide: PaystackService, useValue: mockPaystack },
                { provide: NotificationsService, useValue: mockNotifications },
            ],
        }).compile();

        service = module.get<SubscriptionsService>(SubscriptionsService);
        jest.clearAllMocks();
    });

    // ============================================
    // charge.success
    // ============================================

    describe('handleChargeSuccess - Idempotency', () => {
        const chargeData = {
            reference: 'ref-001',
            plan: { plan_code: 'PLN_starter', name: 'Starter' },
            customer: { customer_code: 'CUS_test123', email: 'test@example.com' },
            metadata: {
                userId: 'user-123',
                tier: 'starter',
                custom_fields: [
                    { variable_name: 'user_id', value: 'user-123' },
                    { variable_name: 'tier', value: 'starter' },
                ],
            },
        };

        it('should handle the same charge.success event twice without errors', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findUnique.mockResolvedValue(subscription);
            mockDb.subscription.update.mockResolvedValue({ ...subscription, tier: 'STARTER' });

            // First call
            await service.handleChargeSuccess(chargeData);
            // Second call (duplicate webhook)
            await service.handleChargeSuccess(chargeData);

            // Both calls should update subscription (idempotent update to same tier)
            expect(mockDb.subscription.update).toHaveBeenCalledTimes(2);
            // Both calls should attempt notification
            expect(mockNotifications.notifySystem).toHaveBeenCalledTimes(2);
        });

        it('should not throw when subscription record is missing', async () => {
            mockDb.subscription.findUnique.mockResolvedValue(null);

            await expect(service.handleChargeSuccess(chargeData)).resolves.not.toThrow();
            expect(mockDb.subscription.update).not.toHaveBeenCalled();
        });

        it('should not throw when userId is missing from metadata', async () => {
            const dataWithoutUserId = {
                ...chargeData,
                metadata: {},
            };

            await expect(service.handleChargeSuccess(dataWithoutUserId)).resolves.not.toThrow();
            expect(mockDb.subscription.findUnique).not.toHaveBeenCalled();
        });

        it('should produce the same DB state regardless of how many times called', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findUnique.mockResolvedValue(subscription);
            mockDb.subscription.update.mockResolvedValue({ ...subscription, tier: 'STARTER' });

            await service.handleChargeSuccess(chargeData);
            const firstCallArgs = mockDb.subscription.update.mock.calls[0];

            await service.handleChargeSuccess(chargeData);
            const secondCallArgs = mockDb.subscription.update.mock.calls[1];

            // The update data should be structurally equivalent (same tier, same limits)
            expect(firstCallArgs[0].data.tier).toEqual(secondCallArgs[0].data.tier);
            expect(firstCallArgs[0].data.geminiEpisodeLimit).toEqual(
                secondCallArgs[0].data.geminiEpisodeLimit,
            );
            expect(firstCallArgs[0].data.standardEpisodeLimit).toEqual(
                secondCallArgs[0].data.standardEpisodeLimit,
            );
        });
    });

    // ============================================
    // subscription.create
    // ============================================

    describe('handleSubscriptionCreate - Idempotency', () => {
        const subscriptionCreateData = {
            subscription_code: 'SUB_test456',
            email_token: 'token-abc',
            status: 'active',
            next_payment_date: '2025-02-01T00:00:00.000Z',
            plan: { plan_code: 'PLN_starter', name: 'Starter' },
            customer: {
                email: 'test@example.com',
                customer_code: 'CUS_test123',
            },
        };

        it('should handle the same subscription.create event twice without errors', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findFirst.mockResolvedValue(subscription);
            mockDb.subscription.update.mockResolvedValue(subscription);

            // First call
            await service.handleSubscriptionCreate(subscriptionCreateData as any);
            // Second call (duplicate webhook)
            await service.handleSubscriptionCreate(subscriptionCreateData as any);

            expect(mockDb.subscription.update).toHaveBeenCalledTimes(2);
            expect(mockNotifications.notifySystem).toHaveBeenCalledTimes(2);
        });

        it('should not throw when no matching subscription record exists', async () => {
            mockDb.subscription.findFirst.mockResolvedValue(null);
            mockDb.user.findUnique.mockResolvedValue(null);

            await expect(
                service.handleSubscriptionCreate(subscriptionCreateData as any),
            ).resolves.not.toThrow();
            expect(mockDb.subscription.update).not.toHaveBeenCalled();
        });

        it('should not throw when customer email is missing', async () => {
            const dataWithoutEmail = {
                ...subscriptionCreateData,
                customer: { customer_code: 'CUS_test123' },
            };

            await expect(
                service.handleSubscriptionCreate(dataWithoutEmail as any),
            ).resolves.not.toThrow();
        });

        it('should find user by email when customer code lookup fails', async () => {
            const subscription = createMockSubscription();
            // First lookup by customer code returns null
            mockDb.subscription.findFirst.mockResolvedValue(null);
            // Lookup by user email succeeds
            mockDb.user.findUnique.mockResolvedValue({ id: 'user-123', email: 'test@example.com' });
            mockDb.subscription.findUnique.mockResolvedValue(subscription);
            mockDb.subscription.update.mockResolvedValue(subscription);

            await service.handleSubscriptionCreate(subscriptionCreateData as any);

            expect(mockDb.user.findUnique).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
            });
            expect(mockDb.subscription.update).toHaveBeenCalledTimes(1);
        });

        it('should produce the same subscription code and token on duplicate events', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findFirst.mockResolvedValue(subscription);
            mockDb.subscription.update.mockResolvedValue(subscription);

            await service.handleSubscriptionCreate(subscriptionCreateData as any);
            const firstUpdate = mockDb.subscription.update.mock.calls[0][0].data;

            await service.handleSubscriptionCreate(subscriptionCreateData as any);
            const secondUpdate = mockDb.subscription.update.mock.calls[1][0].data;

            expect(firstUpdate.paystackSubscriptionCode).toEqual(
                secondUpdate.paystackSubscriptionCode,
            );
            expect(firstUpdate.paystackEmailToken).toEqual(secondUpdate.paystackEmailToken);
            expect(firstUpdate.tier).toEqual(secondUpdate.tier);
        });
    });

    // ============================================
    // subscription.disable
    // ============================================

    describe('handleSubscriptionDisable - Idempotency', () => {
        const disableData = {
            subscription_code: 'SUB_test456',
        };

        it('should handle the same subscription.disable event twice without errors', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findFirst.mockResolvedValue(subscription);

            await service.handleSubscriptionDisable(disableData);
            await service.handleSubscriptionDisable(disableData);

            // Should send notification both times (idempotent - no DB mutation, just notification)
            expect(mockNotifications.notifySystem).toHaveBeenCalledTimes(2);
        });

        it('should not throw when no matching subscription record exists', async () => {
            mockDb.subscription.findFirst.mockResolvedValue(null);

            await expect(service.handleSubscriptionDisable(disableData)).resolves.not.toThrow();
            expect(mockNotifications.notifySystem).not.toHaveBeenCalled();
        });

        it('should not mutate the subscription tier on disable (keeps benefits until expiry)', async () => {
            const subscription = createMockSubscription({ tier: 'PRO' });
            mockDb.subscription.findFirst.mockResolvedValue(subscription);

            await service.handleSubscriptionDisable(disableData);

            // handleSubscriptionDisable should NOT call subscription.update
            // (it only sends a notification, the actual downgrade happens on expiry)
            expect(mockDb.subscription.update).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // subscription.not_renew
    // ============================================

    describe('handleSubscriptionNotRenew - Idempotency', () => {
        const notRenewData = {
            subscription_code: 'SUB_test456',
        };

        it('should handle the same subscription.not_renew event twice without errors', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findFirst.mockResolvedValue(subscription);

            await service.handleSubscriptionNotRenew(notRenewData);
            await service.handleSubscriptionNotRenew(notRenewData);

            expect(mockNotifications.notifySystem).toHaveBeenCalledTimes(2);
        });

        it('should not throw when no matching subscription record exists', async () => {
            mockDb.subscription.findFirst.mockResolvedValue(null);

            await expect(service.handleSubscriptionNotRenew(notRenewData)).resolves.not.toThrow();
            expect(mockNotifications.notifySystem).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // invoice.payment_failed
    // ============================================

    describe('handleInvoicePaymentFailed - Idempotency', () => {
        const failedData = {
            subscription: {
                subscription_code: 'SUB_test456',
            },
        };

        it('should handle the same invoice.payment_failed event twice without errors', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findFirst.mockResolvedValue(subscription);

            await service.handleInvoicePaymentFailed(failedData);
            await service.handleInvoicePaymentFailed(failedData);

            expect(mockNotifications.notifySystem).toHaveBeenCalledTimes(2);
        });

        it('should not throw when no subscription code is in the data', async () => {
            const dataWithoutSubscription = {};

            await expect(
                service.handleInvoicePaymentFailed(dataWithoutSubscription),
            ).resolves.not.toThrow();
            expect(mockDb.subscription.findFirst).not.toHaveBeenCalled();
        });

        it('should not throw when no matching subscription record exists', async () => {
            mockDb.subscription.findFirst.mockResolvedValue(null);

            await expect(service.handleInvoicePaymentFailed(failedData)).resolves.not.toThrow();
            expect(mockNotifications.notifySystem).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // Cross-event idempotency
    // ============================================

    describe('Cross-event Idempotency', () => {
        it('charge.success followed by subscription.create for same user should not conflict', async () => {
            const subscription = createMockSubscription();
            mockDb.subscription.findUnique.mockResolvedValue(subscription);
            mockDb.subscription.findFirst.mockResolvedValue(subscription);
            mockDb.subscription.update.mockResolvedValue(subscription);

            const chargeData = {
                reference: 'ref-001',
                plan: { plan_code: 'PLN_starter', name: 'Starter' },
                customer: { customer_code: 'CUS_test123', email: 'test@example.com' },
                metadata: { userId: 'user-123', tier: 'starter' },
            };

            const createData = {
                subscription_code: 'SUB_test456',
                email_token: 'token-abc',
                status: 'active',
                next_payment_date: '2025-02-01T00:00:00.000Z',
                plan: { plan_code: 'PLN_starter', name: 'Starter' },
                customer: { email: 'test@example.com', customer_code: 'CUS_test123' },
            };

            await service.handleChargeSuccess(chargeData);
            await service.handleSubscriptionCreate(createData as any);

            // Both should complete without error
            expect(mockDb.subscription.update).toHaveBeenCalledTimes(2);
        });
    });
});
