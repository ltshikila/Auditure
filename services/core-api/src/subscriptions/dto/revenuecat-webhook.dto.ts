// RevenueCat webhook event payload shapes.
// Reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
//
// Only fields we actually consume are typed; the rest is preserved as `unknown`
// via index signature so future field additions don't break parsing.

export type RevenueCatEventType =
    | 'INITIAL_PURCHASE'
    | 'RENEWAL'
    | 'PRODUCT_CHANGE'
    | 'CANCELLATION'
    | 'UNCANCELLATION'
    | 'EXPIRATION'
    | 'BILLING_ISSUE'
    | 'SUBSCRIBER_ALIAS'
    | 'NON_RENEWING_PURCHASE'
    | 'TRANSFER'
    | 'TEST';

export interface RevenueCatEvent {
    type: RevenueCatEventType;
    id: string;
    app_user_id: string;
    original_app_user_id?: string;
    product_id: string;                        // e.g. "auditure_premium:starter"
    new_product_id?: string;                   // present on PRODUCT_CHANGE
    purchased_at_ms?: number;
    expiration_at_ms?: number | null;
    event_timestamp_ms: number;
    store?: 'PLAY_STORE' | 'APP_STORE' | 'STRIPE' | 'PROMOTIONAL' | string;
    environment?: 'SANDBOX' | 'PRODUCTION';
    entitlement_ids?: string[];
    cancel_reason?: string;
    expiration_reason?: string;
}

export interface RevenueCatWebhookPayload {
    api_version: string;
    event: RevenueCatEvent;
}
