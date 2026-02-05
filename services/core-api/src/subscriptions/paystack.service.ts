import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

// Paystack API types
export interface PaystackPlan {
    id: number;
    name: string;
    plan_code: string;
    amount: number;
    interval: string;
    currency: string;
}

export interface PaystackCustomer {
    id: number;
    email: string;
    customer_code: string;
    first_name?: string;
    last_name?: string;
    metadata?: Record<string, any>;
}

export interface PaystackSubscription {
    id: number;
    subscription_code: string;
    email_token: string;
    status: string;
    next_payment_date: string;
    plan: PaystackPlan;
    customer: PaystackCustomer;
}

export interface PaystackTransaction {
    id: number;
    reference: string;
    amount: number;
    status: string;
    currency: string;
    authorization_url?: string;
    access_code?: string;
    customer?: PaystackCustomer;
    plan?: PaystackPlan;
    metadata?: Record<string, any>;
}

export interface PaystackWebhookEvent {
    event: string;
    data: any;
}

@Injectable()
export class PaystackService implements OnModuleInit {
    private readonly logger = new Logger(PaystackService.name);
    private secretKey: string;
    private publicKey: string;
    private readonly baseUrl = 'https://api.paystack.co';

    onModuleInit() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
        this.publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';

        if (!this.secretKey) {
            this.logger.warn(
                'PAYSTACK_SECRET_KEY not configured - Paystack functionality will be disabled',
            );
            return;
        }

        this.logger.log('Paystack service initialized successfully');
    }

    isConfigured(): boolean {
        return !!this.secretKey;
    }

    getPublicKey(): string {
        return this.publicKey;
    }

    /**
     * Get Paystack plan code for a subscription tier
     */
    getPlanCode(tier: 'starter' | 'pro'): string {
        const planCode =
            tier === 'starter'
                ? process.env.PAYSTACK_PLAN_CODE_STARTER
                : process.env.PAYSTACK_PLAN_CODE_PRO;

        if (!planCode) {
            throw new Error(`Paystack plan code for ${tier} tier is not configured`);
        }

        return planCode;
    }

    getWebhookSecret(): string {
        return this.secretKey; // Paystack uses the secret key for webhook verification
    }

    getAppUrl(): string {
        return process.env.APP_URL || 'http://localhost:3000';
    }

    getMobileAppScheme(): string {
        return process.env.MOBILE_APP_SCHEME || 'auditure';
    }

    /**
     * Verify webhook signature using HMAC SHA512
     */
    verifyWebhookSignature(payload: string, signature: string): boolean {
        const hash = crypto.createHmac('sha512', this.secretKey).update(payload).digest('hex');
        return hash === signature;
    }

    /**
     * Make authenticated request to Paystack API
     */
    private async request<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        endpoint: string,
        body?: any,
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            this.logger.error(`Paystack API error: ${JSON.stringify(data)}`);
            throw new Error(data.message || 'Paystack API request failed');
        }

        return data.data;
    }

    /**
     * Initialize a transaction with a plan for subscription
     */
    async initializeTransaction(params: {
        email: string;
        amount?: number;
        plan?: string;
        callback_url: string;
        metadata?: Record<string, any>;
        channels?: string[];
    }): Promise<{ authorization_url: string; access_code: string; reference: string }> {
        return this.request('POST', '/transaction/initialize', {
            ...params,
            channels: params.channels || ['card'],
        });
    }

    /**
     * Verify a transaction
     */
    async verifyTransaction(reference: string): Promise<PaystackTransaction> {
        return this.request('GET', `/transaction/verify/${reference}`);
    }

    /**
     * Create a customer
     */
    async createCustomer(params: {
        email: string;
        first_name?: string;
        last_name?: string;
        metadata?: Record<string, any>;
    }): Promise<PaystackCustomer> {
        return this.request('POST', '/customer', params);
    }

    /**
     * Get customer by email
     */
    async getCustomerByEmail(email: string): Promise<PaystackCustomer | null> {
        try {
            return await this.request('GET', `/customer/${encodeURIComponent(email)}`);
        } catch {
            return null;
        }
    }

    /**
     * Create a subscription
     */
    async createSubscription(params: {
        customer: string; // customer email or code
        plan: string; // plan code
        authorization?: string; // authorization code from previous transaction
    }): Promise<PaystackSubscription> {
        return this.request('POST', '/subscription', params);
    }

    /**
     * Get subscription details
     */
    async getSubscription(subscriptionIdOrCode: string): Promise<PaystackSubscription> {
        return this.request('GET', `/subscription/${subscriptionIdOrCode}`);
    }

    /**
     * Disable/cancel a subscription
     */
    async disableSubscription(params: {
        code: string; // subscription code
        token: string; // email token
    }): Promise<{ status: boolean; message: string }> {
        return this.request('POST', '/subscription/disable', params);
    }

    /**
     * Enable a subscription
     */
    async enableSubscription(params: {
        code: string;
        token: string;
    }): Promise<{ status: boolean; message: string }> {
        return this.request('POST', '/subscription/enable', params);
    }

    /**
     * Create a plan
     */
    async createPlan(params: {
        name: string;
        amount: number; // in kobo/cents
        interval: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
        currency?: string;
    }): Promise<PaystackPlan> {
        return this.request('POST', '/plan', {
            ...params,
            currency: params.currency || 'ZAR',
        });
    }

    /**
     * Get plan details
     */
    async getPlan(planIdOrCode: string): Promise<PaystackPlan> {
        return this.request('GET', `/plan/${planIdOrCode}`);
    }

    /**
     * List all plans
     */
    async listPlans(): Promise<PaystackPlan[]> {
        return this.request('GET', '/plan');
    }

    /**
     * List subscriptions for a customer
     */
    async listCustomerSubscriptions(customerIdOrCode: string): Promise<PaystackSubscription[]> {
        return this.request('GET', `/subscription?customer=${customerIdOrCode}`);
    }

    /**
     * Generate a manage subscription link (for customer portal equivalent)
     */
    generateManageSubscriptionLink(subscriptionCode: string): string {
        // Paystack doesn't have a built-in portal, so we'll use the subscription page
        // The customer can manage via the email they receive or via a custom page
        return `https://paystack.com/manage/subscription/${subscriptionCode}`;
    }
}
