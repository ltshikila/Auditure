import { Test, TestingModule } from '@nestjs/testing';
import { ExpoPushService } from './expo-push.service';
import {
    VALID_EXPO_PUSH_TOKEN,
    INVALID_PUSH_TOKENS,
    mockExpoPushSuccessTicket,
    mockExpoPushDeviceNotRegisteredTicket,
    mockExpoPushInvalidCredentialsTicket,
} from '../../../test/fixtures/notifications.fixture';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ExpoPushService', () => {
    let service: ExpoPushService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ExpoPushService],
        }).compile();

        service = module.get<ExpoPushService>(ExpoPushService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ============================================
    // TOKEN VALIDATION TESTS
    // ============================================

    describe('isValidExpoPushToken', () => {
        it('should return true for valid ExponentPushToken format', () => {
            expect(service.isValidExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
        });

        it('should return true for valid ExpoPushToken format', () => {
            expect(service.isValidExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
        });

        it('should return false for invalid token formats', () => {
            INVALID_PUSH_TOKENS.forEach((token) => {
                expect(service.isValidExpoPushToken(token as string)).toBe(false);
            });
        });

        it('should return false for APNs/FCM tokens', () => {
            expect(service.isValidExpoPushToken('abcd1234efgh5678ijkl')).toBe(false);
            expect(service.isValidExpoPushToken('dGVzdC1mY20tdG9rZW4')).toBe(false);
        });
    });

    // ============================================
    // SINGLE PUSH NOTIFICATION TESTS
    // ============================================

    describe('sendPushNotification', () => {
        it('should send push notification successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [mockExpoPushSuccessTicket] }),
            });

            const result = await service.sendPushNotification(
                VALID_EXPO_PUSH_TOKEN,
                'Test Title',
                'Test Body',
            );

            expect(result).toEqual(mockExpoPushSuccessTicket);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://exp.host/--/api/v2/push/send',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.any(String),
                }),
            );
        });

        it('should return error ticket for invalid token format', async () => {
            const result = await service.sendPushNotification(
                'invalid-token',
                'Test Title',
                'Test Body',
            );

            expect(result?.status).toBe('error');
            expect(result?.details?.error).toBe('InvalidCredentials');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should include data payload in push notification', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [mockExpoPushSuccessTicket] }),
            });

            await service.sendPushNotification(
                VALID_EXPO_PUSH_TOKEN,
                'Test Title',
                'Test Body',
                { episodeId: 'episode-123', route: '/episodes/123' },
            );

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining('episodeId'),
                }),
            );
        });

        it('should handle HTTP error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });

            const result = await service.sendPushNotification(
                VALID_EXPO_PUSH_TOKEN,
                'Test Title',
                'Test Body',
            );

            expect(result?.status).toBe('error');
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await service.sendPushNotification(
                VALID_EXPO_PUSH_TOKEN,
                'Test Title',
                'Test Body',
            );

            expect(result?.status).toBe('error');
            expect(result?.message).toBe('Network error');
        });
    });

    // ============================================
    // BATCH PUSH NOTIFICATION TESTS
    // ============================================

    describe('sendPushNotificationsBatch', () => {
        it('should send batch notifications successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [mockExpoPushSuccessTicket, mockExpoPushSuccessTicket],
                }),
            });

            const result = await service.sendPushNotificationsBatch([
                { to: VALID_EXPO_PUSH_TOKEN, title: 'Test 1', body: 'Body 1' },
                { to: VALID_EXPO_PUSH_TOKEN, title: 'Test 2', body: 'Body 2' },
            ]);

            expect(result).toHaveLength(2);
            expect(result.every((t) => t.status === 'ok')).toBe(true);
        });

        it('should return empty array for empty input', async () => {
            const result = await service.sendPushNotificationsBatch([]);

            expect(result).toHaveLength(0);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should filter out invalid tokens', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [mockExpoPushSuccessTicket] }),
            });

            const result = await service.sendPushNotificationsBatch([
                { to: VALID_EXPO_PUSH_TOKEN, title: 'Valid', body: 'Body' },
                { to: 'invalid-token', title: 'Invalid', body: 'Body' },
            ]);

            // Only one valid notification should be sent
            const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(sentBody).toHaveLength(1);
        });

        it('should return empty array when all tokens are invalid', async () => {
            const result = await service.sendPushNotificationsBatch([
                { to: 'invalid-token-1', title: 'Test 1', body: 'Body 1' },
                { to: 'invalid-token-2', title: 'Test 2', body: 'Body 2' },
            ]);

            expect(result).toHaveLength(0);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should batch notifications in groups of 100', async () => {
            // Create 150 messages
            const messages = Array.from({ length: 150 }, (_, i) => ({
                to: VALID_EXPO_PUSH_TOKEN,
                title: `Test ${i}`,
                body: `Body ${i}`,
            }));

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: Array(100).fill(mockExpoPushSuccessTicket),
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: Array(50).fill(mockExpoPushSuccessTicket),
                    }),
                });

            const result = await service.sendPushNotificationsBatch(messages);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(150);
        });

        it('should retry on server error (5xx)', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    text: async () => 'Server Error',
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: [mockExpoPushSuccessTicket] }),
                });

            const result = await service.sendPushNotificationsBatch([
                { to: VALID_EXPO_PUSH_TOKEN, title: 'Test', body: 'Body' },
            ]);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result[0].status).toBe('ok');
        });

        it('should not retry on client error (4xx)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => 'Bad Request',
            });

            const result = await service.sendPushNotificationsBatch([
                { to: VALID_EXPO_PUSH_TOKEN, title: 'Test', body: 'Body' },
            ]);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result[0].status).toBe('error');
        });
    });

    // ============================================
    // PUSH RECEIPTS TESTS
    // ============================================

    describe('getPushReceipts', () => {
        it('should fetch receipts successfully', async () => {
            const mockReceipts = {
                'ticket-1': { status: 'ok' },
                'ticket-2': { status: 'ok' },
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockReceipts }),
            });

            const result = await service.getPushReceipts(['ticket-1', 'ticket-2']);

            expect(result.size).toBe(2);
            expect(result.get('ticket-1')?.status).toBe('ok');
        });

        it('should return empty map for empty input', async () => {
            const result = await service.getPushReceipts([]);

            expect(result.size).toBe(0);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should handle receipt fetch errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await service.getPushReceipts(['ticket-1']);

            expect(result.size).toBe(0);
        });
    });

    // ============================================
    // INVALID TOKEN DETECTION TESTS
    // ============================================

    describe('getInvalidTokenFromTicket', () => {
        it('should return token for DeviceNotRegistered error', () => {
            const result = service.getInvalidTokenFromTicket(
                mockExpoPushDeviceNotRegisteredTicket,
                VALID_EXPO_PUSH_TOKEN,
            );

            expect(result).toBe(VALID_EXPO_PUSH_TOKEN);
        });

        it('should return null for successful ticket', () => {
            const result = service.getInvalidTokenFromTicket(
                mockExpoPushSuccessTicket,
                VALID_EXPO_PUSH_TOKEN,
            );

            expect(result).toBeNull();
        });

        it('should return null for other error types', () => {
            const result = service.getInvalidTokenFromTicket(
                mockExpoPushInvalidCredentialsTicket,
                VALID_EXPO_PUSH_TOKEN,
            );

            expect(result).toBeNull();
        });
    });
});
