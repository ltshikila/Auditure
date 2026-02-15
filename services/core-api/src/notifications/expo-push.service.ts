import { Injectable, Logger } from '@nestjs/common';
import {
    ExpoPushTicket,
    ExpoPushReceipt,
    NotificationPayload,
} from './interfaces/notification-payload.interface';

/**
 * Message structure for Expo Push API
 */
interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: NotificationPayload;
    sound?: 'default' | null;
    badge?: number;
    channelId?: string;
    priority?: 'default' | 'normal' | 'high';
    ttl?: number;
}

/**
 * Service for sending push notifications via Expo Push API.
 * Handles batching, retries, and error handling for push notification delivery.
 */
@Injectable()
export class ExpoPushService {
    private readonly logger = new Logger(ExpoPushService.name);
    private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
    private readonly EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
    private readonly MAX_BATCH_SIZE = 100; // Expo recommends max 100 per request
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 1000;
    private readonly expoAccessToken = (process.env.EXPO_ACCESS_TOKEN || '').trim();

    /**
     * Validates if a token is a valid Expo push token.
     * @param token - The token to validate
     * @returns True if valid Expo push token format
     */
    isValidExpoPushToken(token: string): boolean {
        if (!token || typeof token !== 'string') {
            return false;
        }
        // Expo push tokens follow the format "ExponentPushToken[xxx]" or "ExpoPushToken[xxx]"
        // where xxx is a non-empty token value
        const exponentMatch = token.match(/^ExponentPushToken\[(.+)\]$/);
        const expoMatch = token.match(/^ExpoPushToken\[(.+)\]$/);
        return !!(exponentMatch || expoMatch);
    }

    /**
     * Send a single push notification.
     * @param pushToken - The Expo push token
     * @param title - Notification title
     * @param body - Notification body
     * @param data - Optional payload data for deep linking
     * @returns Push ticket or null on failure
     */
    async sendPushNotification(
        pushToken: string,
        title: string,
        body: string,
        data?: NotificationPayload,
    ): Promise<ExpoPushTicket | null> {
        this.logger.log(`sendPushNotification() called for token: ${this.maskToken(pushToken)}`);

        if (!this.isValidExpoPushToken(pushToken)) {
            this.logger.warn(`Invalid Expo push token format: ${this.maskToken(pushToken)}`);
            return {
                status: 'error',
                message: 'Invalid push token format',
                details: { error: 'InvalidCredentials' },
            };
        }

        const message: ExpoPushMessage = {
            to: pushToken,
            title,
            body,
            data,
            sound: 'default',
            priority: 'high',
        };

        const tickets = await this.sendPushNotificationsBatch([message]);
        return tickets.length > 0 ? tickets[0] : null;
    }

    /**
     * Send multiple push notifications in batches.
     * @param notifications - Array of notifications to send
     * @returns Array of push tickets
     */
    async sendPushNotificationsBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
        this.logger.log(`sendPushNotificationsBatch() called with ${messages.length} messages`);

        if (messages.length === 0) {
            return [];
        }

        // Filter out invalid tokens
        const validMessages = messages.filter(msg => this.isValidExpoPushToken(msg.to));
        const invalidCount = messages.length - validMessages.length;

        if (invalidCount > 0) {
            this.logger.warn(`Filtered out ${invalidCount} messages with invalid push tokens`);
        }

        if (validMessages.length === 0) {
            this.logger.warn('No valid push tokens to send to');
            return [];
        }

        const allTickets: ExpoPushTicket[] = [];

        // Process in batches
        for (let i = 0; i < validMessages.length; i += this.MAX_BATCH_SIZE) {
            const batch = validMessages.slice(i, i + this.MAX_BATCH_SIZE);
            const tickets = await this.sendBatchWithRetry(batch);
            allTickets.push(...tickets);
        }

        // Log summary
        const successCount = allTickets.filter(t => t.status === 'ok').length;
        const errorCount = allTickets.filter(t => t.status === 'error').length;
        this.logger.log(
            `Push notification batch complete: ${successCount} succeeded, ${errorCount} failed`,
        );

        return allTickets;
    }

    /**
     * Send a batch of notifications with retry logic.
     */
    private async sendBatchWithRetry(
        messages: ExpoPushMessage[],
        attempt: number = 1,
    ): Promise<ExpoPushTicket[]> {
        try {
            const headers: Record<string, string> = {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            };
            if (this.expoAccessToken) {
                headers['Authorization'] = `Bearer ${this.expoAccessToken}`;
            }

            const response = await fetch(this.EXPO_PUSH_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(messages),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Expo Push API error (HTTP ${response.status}): ${errorText}`);

                // Retry on server errors
                if (response.status >= 500 && attempt < this.MAX_RETRIES) {
                    this.logger.warn(`Retrying batch (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
                    await this.delay(this.RETRY_DELAY_MS * attempt);
                    return this.sendBatchWithRetry(messages, attempt + 1);
                }

                // Return error tickets for all messages
                return messages.map(() => ({
                    status: 'error' as const,
                    message: `HTTP ${response.status}: ${errorText}`,
                }));
            }

            const result = await response.json();
            const tickets: ExpoPushTicket[] = result.data || [];

            // Log any errors
            tickets.forEach((ticket, index) => {
                if (ticket.status === 'error') {
                    this.logger.error(
                        `Push notification failed for ${this.maskToken(messages[index].to)}: ` +
                            `${ticket.message} (${ticket.details?.error || 'unknown error'})`,
                    );
                }
            });

            return tickets;
        } catch (error) {
            this.logger.error(`Failed to send push notifications: ${error.message}`);

            // Retry on network errors
            if (attempt < this.MAX_RETRIES) {
                this.logger.warn(`Retrying batch (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
                await this.delay(this.RETRY_DELAY_MS * attempt);
                return this.sendBatchWithRetry(messages, attempt + 1);
            }

            // Return error tickets for all messages
            return messages.map(() => ({
                status: 'error' as const,
                message: error.message,
            }));
        }
    }

    /**
     * Get receipts for previously sent notifications.
     * Use this to check delivery status after sending.
     * @param ticketIds - Array of ticket IDs from send responses
     * @returns Map of ticket ID to receipt
     */
    async getPushReceipts(ticketIds: string[]): Promise<Map<string, ExpoPushReceipt>> {
        this.logger.log(`getPushReceipts() called for ${ticketIds.length} tickets`);

        if (ticketIds.length === 0) {
            return new Map();
        }

        const receiptsMap = new Map<string, ExpoPushReceipt>();

        // Process in batches (Expo recommends max 1000 per request)
        const batchSize = 1000;
        for (let i = 0; i < ticketIds.length; i += batchSize) {
            const batch = ticketIds.slice(i, i + batchSize);

            try {
                const receiptHeaders: Record<string, string> = {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                };
                if (this.expoAccessToken) {
                    receiptHeaders['Authorization'] = `Bearer ${this.expoAccessToken}`;
                }

                const response = await fetch(this.EXPO_RECEIPTS_URL, {
                    method: 'POST',
                    headers: receiptHeaders,
                    body: JSON.stringify({ ids: batch }),
                });

                if (!response.ok) {
                    this.logger.error(`Failed to get receipts: HTTP ${response.status}`);
                    continue;
                }

                const result = await response.json();
                const receipts = result.data || {};

                for (const [id, receipt] of Object.entries(receipts)) {
                    receiptsMap.set(id, receipt as ExpoPushReceipt);

                    // Log errors for investigation
                    const r = receipt as ExpoPushReceipt;
                    if (r.status === 'error') {
                        this.logger.error(
                            `Push receipt error for ${id}: ${r.message} (${r.details?.error || 'unknown'})`,
                        );
                    }
                }
            } catch (error) {
                this.logger.error(`Error fetching push receipts: ${error.message}`);
            }
        }

        return receiptsMap;
    }

    /**
     * Handle a DeviceNotRegistered error by returning the invalid token.
     * The caller should remove this token from the database.
     * @param ticket - The push ticket to check
     * @param token - The token that was used
     * @returns The token if it should be removed, null otherwise
     */
    getInvalidTokenFromTicket(ticket: ExpoPushTicket, token: string): string | null {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            this.logger.warn(
                `Device not registered, token should be removed: ${this.maskToken(token)}`,
            );
            return token;
        }
        return null;
    }

    /**
     * Mask a push token for safe logging.
     */
    private maskToken(token: string): string {
        if (!token || token.length < 20) {
            return '***';
        }
        return `${token.substring(0, 20)}...${token.substring(token.length - 5)}`;
    }

    /**
     * Delay helper for retries.
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
