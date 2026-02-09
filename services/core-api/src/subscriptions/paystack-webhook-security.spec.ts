/**
 * Paystack Webhook Security Tests
 *
 * Tests HMAC-SHA512 signature verification for Paystack webhooks.
 * Paystack signs webhook payloads using the merchant's secret key with
 * HMAC-SHA512 and sends the signature in the `x-paystack-signature` header.
 *
 * The verification logic is in PaystackService.verifyWebhookSignature()
 * and is enforced in SubscriptionsWebhookController.handleWebhook().
 */
import * as crypto from 'crypto';
import { PaystackService } from './paystack.service';

describe('Paystack Webhook Signature Verification', () => {
    let service: PaystackService;
    const TEST_SECRET_KEY = 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

    beforeEach(() => {
        // Set the env var before initializing the service
        process.env.PAYSTACK_SECRET_KEY = TEST_SECRET_KEY;
        process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_yyyyyyyyyyyyyyyyyyyyyyyy';

        service = new PaystackService();
        // Call onModuleInit to pick up the env vars
        service.onModuleInit();
    });

    afterEach(() => {
        delete process.env.PAYSTACK_SECRET_KEY;
        delete process.env.PAYSTACK_PUBLIC_KEY;
    });

    /**
     * Helper: compute the correct HMAC-SHA512 signature for a payload.
     */
    function computeSignature(payload: string, secretKey: string): string {
        return crypto.createHmac('sha512', secretKey).update(payload).digest('hex');
    }

    // ============================================
    // Valid Signature
    // ============================================

    describe('Valid Signature', () => {
        it('should return true for a correctly signed payload', () => {
            const payload = JSON.stringify({
                event: 'charge.success',
                data: { reference: 'ref-001', amount: 999 },
            });
            const signature = computeSignature(payload, TEST_SECRET_KEY);

            expect(service.verifyWebhookSignature(payload, signature)).toBe(true);
        });

        it('should return true for any valid JSON payload with correct signature', () => {
            const payload = JSON.stringify({
                event: 'subscription.create',
                data: {
                    subscription_code: 'SUB_abc',
                    email_token: 'tok_123',
                    customer: { email: 'user@example.com' },
                },
            });
            const signature = computeSignature(payload, TEST_SECRET_KEY);

            expect(service.verifyWebhookSignature(payload, signature)).toBe(true);
        });

        it('should return true for a minimal payload', () => {
            const payload = '{}';
            const signature = computeSignature(payload, TEST_SECRET_KEY);

            expect(service.verifyWebhookSignature(payload, signature)).toBe(true);
        });

        it('should return true for non-JSON text if signature matches', () => {
            const payload = 'plain text body';
            const signature = computeSignature(payload, TEST_SECRET_KEY);

            expect(service.verifyWebhookSignature(payload, signature)).toBe(true);
        });
    });

    // ============================================
    // Wrong Key
    // ============================================

    describe('Wrong Key', () => {
        it('should return false when signed with a different secret key', () => {
            const payload = JSON.stringify({
                event: 'charge.success',
                data: { reference: 'ref-001' },
            });
            const wrongKey = 'sk_test_wrong_key_completely_different';
            const signature = computeSignature(payload, wrongKey);

            expect(service.verifyWebhookSignature(payload, signature)).toBe(false);
        });

        it('should return false when signed with an empty key', () => {
            const payload = JSON.stringify({ event: 'charge.success' });
            const signature = computeSignature(payload, '');

            expect(service.verifyWebhookSignature(payload, signature)).toBe(false);
        });

        it('should return false when signed with the public key instead of secret key', () => {
            const payload = JSON.stringify({ event: 'charge.success' });
            const signature = computeSignature(
                payload,
                'pk_test_yyyyyyyyyyyyyyyyyyyyyyyy',
            );

            expect(service.verifyWebhookSignature(payload, signature)).toBe(false);
        });
    });

    // ============================================
    // Tampered Payload
    // ============================================

    describe('Tampered Payload', () => {
        it('should return false when payload is modified after signing', () => {
            const originalPayload = JSON.stringify({
                event: 'charge.success',
                data: { reference: 'ref-001', amount: 999 },
            });
            const signature = computeSignature(originalPayload, TEST_SECRET_KEY);

            // Tamper with the payload (change amount)
            const tamperedPayload = JSON.stringify({
                event: 'charge.success',
                data: { reference: 'ref-001', amount: 0 },
            });

            expect(service.verifyWebhookSignature(tamperedPayload, signature)).toBe(false);
        });

        it('should return false when extra whitespace is added to payload', () => {
            const payload = JSON.stringify({ event: 'charge.success' });
            const signature = computeSignature(payload, TEST_SECRET_KEY);

            // Add a trailing space
            const tamperedPayload = payload + ' ';

            expect(service.verifyWebhookSignature(tamperedPayload, signature)).toBe(false);
        });

        it('should return false when a single character is changed', () => {
            const payload = JSON.stringify({
                event: 'charge.success',
                data: { reference: 'ref-001' },
            });
            const signature = computeSignature(payload, TEST_SECRET_KEY);

            // Change one character in the reference
            const tamperedPayload = JSON.stringify({
                event: 'charge.success',
                data: { reference: 'ref-002' },
            });

            expect(service.verifyWebhookSignature(tamperedPayload, signature)).toBe(false);
        });

        it('should return false when event type is changed', () => {
            const payload = JSON.stringify({
                event: 'charge.success',
                data: { reference: 'ref-001' },
            });
            const signature = computeSignature(payload, TEST_SECRET_KEY);

            const tamperedPayload = JSON.stringify({
                event: 'charge.failed',
                data: { reference: 'ref-001' },
            });

            expect(service.verifyWebhookSignature(tamperedPayload, signature)).toBe(false);
        });
    });

    // ============================================
    // Empty / Missing Signature
    // ============================================

    describe('Empty / Missing Signature', () => {
        it('should return false for an empty signature string', () => {
            const payload = JSON.stringify({ event: 'charge.success' });

            expect(service.verifyWebhookSignature(payload, '')).toBe(false);
        });

        it('should return false for a random non-hex string as signature', () => {
            const payload = JSON.stringify({ event: 'charge.success' });

            expect(service.verifyWebhookSignature(payload, 'not-a-valid-signature')).toBe(false);
        });

        it('should return false for a truncated valid signature', () => {
            const payload = JSON.stringify({ event: 'charge.success' });
            const validSignature = computeSignature(payload, TEST_SECRET_KEY);
            const truncated = validSignature.substring(0, 32);

            expect(service.verifyWebhookSignature(payload, truncated)).toBe(false);
        });

        it('should return false for null coerced as signature', () => {
            const payload = JSON.stringify({ event: 'charge.success' });

            // Simulating a null value being coerced to string by the framework
            expect(service.verifyWebhookSignature(payload, null as any)).toBe(false);
        });

        it('should return false for undefined coerced as signature', () => {
            const payload = JSON.stringify({ event: 'charge.success' });

            expect(service.verifyWebhookSignature(payload, undefined as any)).toBe(false);
        });
    });

    // ============================================
    // Service configuration
    // ============================================

    describe('Service Configuration', () => {
        it('should report as configured when secret key is set', () => {
            expect(service.isConfigured()).toBe(true);
        });

        it('should use the secret key as the webhook secret', () => {
            expect(service.getWebhookSecret()).toBe(TEST_SECRET_KEY);
        });
    });
});
