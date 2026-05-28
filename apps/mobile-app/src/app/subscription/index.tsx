import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { storageService } from '@/services/storage.service';
import {
    subscriptionService,
    SubscriptionStatus,
    SubscriptionTier,
    Pricing,
} from '@/services/subscription.service';
import { TopBar } from '@/components';
import { SubscriptionSkeleton } from '@/components/skeleton';
import { useAlert } from '@/contexts/AlertContext';
import { PRORATION_MODE, useRevenueCat } from '@/contexts/RevenueCatContext';
import { track } from '@/lib/posthog';

const BASE_PRODUCT_ID = 'auditure_premium';
const STARTER_PRODUCT_ID = `${BASE_PRODUCT_ID}:starter`;
const PRO_PRODUCT_ID = `${BASE_PRODUCT_ID}:pro`;
const TIER_GEMINI_LIMITS: Record<'FREE' | 'STARTER' | 'PRO', number> = {
    FREE: 1,
    STARTER: 20,
    PRO: 50,
};

type PricingCardProps = {
    title: string;
    price: string;
    episodesPerMonth: number;
    isSelected: boolean;
    onSelect: () => void;
    disabled?: boolean;
    isPopular?: boolean;
    icon: keyof typeof Ionicons.glyphMap;
};

function PricingCard({
    title,
    price,
    episodesPerMonth,
    isSelected,
    onSelect,
    disabled,
    isPopular,
    icon,
}: PricingCardProps) {
    return (
        <TouchableOpacity
            onPress={onSelect}
            disabled={disabled}
            className={`flex-1 p-4 rounded-2xl ${disabled ? 'opacity-50' : ''}`}
            style={{
                backgroundColor: isSelected ? '#FDF8EE' : '#F5F5F0',
                borderWidth: 2,
                borderColor: isSelected ? '#BF9A54' : '#F5F5F0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                shadowOpacity: isSelected ? 0.12 : 0.05,
                shadowRadius: isSelected ? 8 : 4,
                elevation: isSelected ? 4 : 2,
            }}>
            {/* Popular Badge */}
            {isPopular && (
                <View className="bg-brand-gold px-2.5 py-1 rounded-full self-start mb-3">
                    <Text className="font-inter-bold text-white text-[10px]">BEST VALUE</Text>
                </View>
            )}

            {/* Icon */}
            <View
                className={`w-10 h-10 rounded-xl items-center justify-center mb-3 ${
                    isSelected ? 'bg-brand-gold' : 'bg-brand-gold/20'
                }`}>
                <Ionicons name={icon} size={20} color={isSelected ? 'white' : '#BF9A54'} />
            </View>

            {/* Title */}
            <Text className="font-inter-bold text-lg text-gray-900">{title}</Text>

            {/* Price */}
            <View className="flex-row items-baseline mt-1">
                <Text className="font-inter-bold text-2xl text-brand-gold">{price}</Text>
                <Text className="font-inter text-gray-500 text-sm ml-1">/mo</Text>
            </View>

            {/* Episodes */}
            <View className="flex-row items-center mt-2">
                <Ionicons name="mic-outline" size={14} color="#6B7280" />
                <Text className="font-inter text-gray-600 text-sm ml-1.5">
                    {episodesPerMonth} episodes
                </Text>
            </View>

            {/* Selection indicator */}
            <View
                className={`w-5 h-5 rounded-full border-2 mt-3 items-center justify-center ${
                    isSelected ? 'border-brand-gold bg-brand-gold' : 'border-gray-300'
                }`}>
                {isSelected && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
        </TouchableOpacity>
    );
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
    const percentage = Math.min((used / limit) * 100, 100);
    const isLow = percentage >= 80;

    return (
        <View className="mb-4 last:mb-0">
            <View className="flex-row justify-between mb-2">
                <Text className="font-inter text-gray-600 dark:text-brand-dark-text-secondary">{label}</Text>
                <Text className={`font-inter-medium ${isLow ? 'text-orange-500' : 'text-gray-900 dark:text-brand-dark-text'}`}>
                    {used} / {limit}
                </Text>
            </View>
            <View className="h-2 bg-gray-200 dark:bg-brand-dark-border rounded-full overflow-hidden">
                <View
                    className={`h-full rounded-full ${isLow ? 'bg-orange-400' : 'bg-brand-gold'}`}
                    style={{ width: `${percentage}%` }}
                />
            </View>
        </View>
    );
}

export default function SubscriptionScreen() {
    const { showAlert } = useAlert();
    const {
        currentOffering,
        customerInfo,
        hasPremium,
        activeProductIdentifier,
        purchasePackage,
        presentCustomerCenter,
        refresh: refreshRC,
    } = useRevenueCat();
    const [backendStatus, setBackendStatus] = useState<SubscriptionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro');

    const subscription = useMemo<SubscriptionStatus | null>(() => {
        if (!backendStatus) return null;
        const rcEntitlement = customerInfo?.entitlements.active['premium'] ?? null;
        const hasComp = !!backendStatus.comp;

        // RC + comp are the only authoritative sources for entitlement state.
        // We deliberately ignore the backend's tier/isPaid/isCancelled fields
        // — those reflect the (now-retired) Paystack flow and can leave stale
        // STARTER/PRO rows on users who never actually bought through Play.
        const rcTier: 'PRO' | 'STARTER' | null =
            activeProductIdentifier === PRO_PRODUCT_ID ? 'PRO'
            : activeProductIdentifier === STARTER_PRODUCT_ID ? 'STARTER'
            : null;
        const tier: 'FREE' | 'STARTER' | 'PRO' =
            rcTier ?? (hasComp ? 'PRO' : 'FREE');

        return {
            ...backendStatus,
            tier,
            isPaid: hasPremium || hasComp,
            isCancelled: rcEntitlement ? rcEntitlement.willRenew === false : false,
            premiumStartedAt: rcEntitlement?.latestPurchaseDate ?? null,
            premiumExpiresAt: rcEntitlement?.expirationDate ?? null,
            usage: {
                ...backendStatus.usage,
                geminiEpisodeLimit: TIER_GEMINI_LIMITS[tier],
            },
        };
    }, [backendStatus, customerInfo, activeProductIdentifier, hasPremium]);

    const { status, reason, source } = useLocalSearchParams<{ status?: string; reason?: string; source?: string }>();
    const pricing: Pricing = subscriptionService.getPricing();
    const paywallSource = source || 'direct';

    useEffect(() => {
        track('paywall_viewed', { source: paywallSource });
    }, [paywallSource]);

    useEffect(() => {
        if (status === 'success') {
            track('checkout_returned', { outcome: 'success', tier: selectedTier, source: paywallSource });
            showAlert({
                title: 'Payment Successful!',
                message: 'Your subscription is now active. Enjoy your premium features!',
            });
            router.setParams({ status: undefined, reason: undefined });
        } else if (status === 'failed') {
            track('checkout_returned', { outcome: 'failed', tier: selectedTier, reason, source: paywallSource });
            showAlert({
                title: 'Payment Failed',
                message: reason
                    ? `Payment was not completed: ${reason}`
                    : 'Your payment could not be processed. Please try again.',
            });
            router.setParams({ status: undefined, reason: undefined });
        } else if (status === 'error') {
            track('checkout_returned', { outcome: 'error', tier: selectedTier, source: paywallSource });
            showAlert({ title: 'Error', message: 'Something went wrong. Please try again or contact support.' });
            router.setParams({ status: undefined, reason: undefined });
        } else if (status === 'cancelled') {
            track('checkout_returned', { outcome: 'cancelled', tier: selectedTier, source: paywallSource });
            router.setParams({ status: undefined, reason: undefined });
        }
    }, [status, reason]);

    const fetchSubscription = async (isRefreshing: boolean = false) => {
        try {
            if (isRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            const [data] = await Promise.all([
                subscriptionService.getSubscriptionStatus(token),
                refreshRC(),
            ]);
            setBackendStatus(data);
        } catch (err: any) {
            console.error('Error fetching subscription:', err);
            setError(err.message || 'Failed to load subscription');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchSubscription();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchSubscription();
        }, []),
    );

    const onRefresh = () => {
        fetchSubscription(true);
    };

    const findPackageByProductId = useCallback(
        (productId: string) =>
            currentOffering?.availablePackages.find(
                (p) => p.product.identifier === productId,
            ) ?? null,
        [currentOffering],
    );

    const handleSubscribe = async () => {
        track('paywall_cta_tapped', { tier: selectedTier, action: 'subscribe', source: paywallSource });
        const productId = selectedTier === 'pro' ? PRO_PRODUCT_ID : STARTER_PRODUCT_ID;
        const pkg = findPackageByProductId(productId);
        if (!pkg) {
            setError('Subscription option not available. Pull to refresh and try again.');
            return;
        }
        try {
            setPurchasing(true);
            setError(null);
            track('checkout_started', { tier: selectedTier, action: 'subscribe', source: paywallSource });
            const outcome = await purchasePackage(pkg);
            await fetchSubscription();
            if (outcome.status === 'purchased') {
                showAlert({
                    title: 'Subscription Activated!',
                    message: `Welcome to Auditure ${subscriptionService.getTierDisplayName(selectedTier)}! Enjoy your podcast episodes.`,
                });
            } else if (outcome.status === 'error') {
                setError(outcome.message);
            }
        } catch (err: any) {
            console.error('Subscription error:', err);
            setError(err.message || 'Failed to start subscription');
        } finally {
            setPurchasing(false);
        }
    };

    const handleUpgrade = async () => {
        track('paywall_cta_tapped', { tier: 'pro', action: 'upgrade', source: paywallSource });
        const proPkg = findPackageByProductId(PRO_PRODUCT_ID);
        if (!proPkg) {
            setError('Pro plan not available. Pull to refresh and try again.');
            return;
        }
        try {
            setPurchasing(true);
            setError(null);
            track('checkout_started', { tier: 'pro', action: 'upgrade', source: paywallSource });
            // Only do a product change when RC sees an active entitlement to
            // switch from; otherwise BillingClient throws DEVELOPER_ERROR.
            const outcome = await purchasePackage(
                proPkg,
                hasPremium ? { oldProductIdentifier: BASE_PRODUCT_ID } : undefined,
            );
            await fetchSubscription();
            if (outcome.status === 'purchased') {
                showAlert({
                    title: 'Upgrade Successful!',
                    message: 'Welcome to Auditure Pro! Enjoy your 50 episodes per month.',
                });
            } else if (outcome.status === 'error') {
                setError(outcome.message);
            }
        } catch (err: any) {
            console.error('Upgrade error:', err);
            setError(err.message || 'Failed to upgrade subscription');
        } finally {
            setPurchasing(false);
        }
    };

    const handleDowngrade = async () => {
        track('paywall_cta_tapped', { tier: 'starter', action: 'downgrade', source: paywallSource });
        const starterPkg = findPackageByProductId(STARTER_PRODUCT_ID);
        if (!starterPkg) {
            setError('Starter plan not available. Pull to refresh and try again.');
            return;
        }
        try {
            setPurchasing(true);
            setError(null);
            track('checkout_started', { tier: 'starter', action: 'downgrade', source: paywallSource });
            const outcome = await purchasePackage(
                starterPkg,
                hasPremium
                    ? {
                          oldProductIdentifier: BASE_PRODUCT_ID,
                          prorationMode: PRORATION_MODE.DEFERRED,
                      }
                    : undefined,
            );
            await fetchSubscription();
            if (outcome.status === 'purchased') {
                showAlert({
                    title: 'Plan Change Scheduled',
                    message: 'You will switch to the Starter plan at the end of your current billing period.',
                });
            } else if (outcome.status === 'error') {
                setError(outcome.message);
            }
        } catch (err: any) {
            console.error('Downgrade error:', err);
            setError(err.message || 'Failed to change subscription');
        } finally {
            setPurchasing(false);
        }
    };

    const handleCancelSubscription = () => {
        track('subscription_cancel_started', { tier: subscription?.tier });
        showAlert({
            title: "We're sorry to see you go",
            message: 'Before you cancel, could you tell us why?',
            buttons: [
                { text: 'Keep My Subscription' },
                {
                    text: "It's too expensive",
                    style: 'cancel',
                    onPress: () => showPauseOffer(),
                },
                {
                    text: "I don't use it enough",
                    style: 'cancel',
                    onPress: () => showPauseOffer(),
                },
                {
                    text: 'Other reason',
                    style: 'cancel',
                    onPress: () => showFinalConfirmation(),
                },
            ],
        });
    };

    const showPauseOffer = () => {
        // Step 2: Offer alternatives
        showAlert({
            title: 'How about a pause instead?',
            message: "We'd hate to lose you! Would you like to pause your subscription for a month instead of cancelling?",
            buttons: [
                { text: 'Keep My Subscription' },
                {
                    text: 'Pause for 1 Month',
                    style: 'cancel',
                    onPress: () => {
                        showAlert({
                            title: 'Feature Coming Soon',
                            message: "We're working on adding pause functionality. For now, you can cancel and resubscribe anytime.",
                        });
                    },
                },
                {
                    text: 'Continue Cancelling',
                    style: 'cancel',
                    onPress: () => showFinalConfirmation(),
                },
            ],
        });
    };

    const showFinalConfirmation = () => {
        // Step 3: Final guilt trip
        showAlert({
            title: 'Are you absolutely sure?',
            message: `You'll lose access to:\n\n• ${subscription?.usage.geminiEpisodeLimit ?? 30} monthly episodes\n• Premium voice quality\n• All your saved preferences\n\nYour subscription will remain active until the end of your billing period.`,
            buttons: [
                { text: "No, I'll Stay!" },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: () => performCancellation(),
                },
            ],
        });
    };

    const performCancellation = async () => {
        try {
            setPurchasing(true);
            await presentCustomerCenter();
            track('subscription_cancel_completed', { tier: subscription?.tier });
            await fetchSubscription();
        } catch (err: any) {
            track('subscription_cancel_failed', { tier: subscription?.tier, message: err?.message });
            showAlert({ title: 'Error', message: err.message || 'Failed to open subscription management' });
        } finally {
            setPurchasing(false);
        }
    };

    const handleReactivate = async () => {
        track('subscription_reactivate_started', { tier: subscription?.tier });
        try {
            setPurchasing(true);
            await presentCustomerCenter();
            track('subscription_reactivate_completed', { tier: subscription?.tier });
            await fetchSubscription();
        } catch (err: any) {
            track('subscription_reactivate_failed', { tier: subscription?.tier, message: err?.message });
            showAlert({ title: 'Error', message: err.message || 'Failed to open subscription management' });
            await fetchSubscription();
        } finally {
            setPurchasing(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return null;
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg" edges={['top', 'left', 'right']}>
                <TopBar showBackButton title="Subscription" />
                <SubscriptionSkeleton />
            </SafeAreaView>
        );
    }

    const isPaid = subscription?.isPaid ?? false;
    const isCancelled = subscription?.isCancelled ?? false;
    const comp = subscription?.comp ?? null;
    const isComped = comp !== null;

    return (
        <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg" edges={['top', 'left', 'right']}>
            <TopBar showBackButton title="Subscription" />

            <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BF9A54" />
                }>
                {/* Header */}
                <View className="mb-6">
                    <Text className="font-inter-bold text-2xl text-brand-black dark:text-brand-dark-text">
                        {isComped ? 'Your Complimentary Access' : isPaid ? 'Your Subscription' : 'Unlock Premium'}
                    </Text>
                    <Text className="font-jakarta text-gray-600 dark:text-brand-dark-text-secondary mt-1">
                        {isComped
                            ? 'Enjoy PRO on us — subscribe before it ends to keep going'
                            : isPaid
                              ? 'Manage your premium subscription'
                              : 'Create more podcast episodes from your books'}
                    </Text>
                </View>

                {/* Error Message */}
                {error && (
                    <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex-row items-start">
                        <Ionicons name="alert-circle" size={20} color="#DC2626" />
                        <View className="flex-1 ml-3">
                            <Text className="font-inter-medium text-red-800">{error}</Text>
                            <TouchableOpacity onPress={() => fetchSubscription()} className="mt-2">
                                <Text className="font-inter-bold text-red-600">Tap to retry</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Current Status Card */}
                <View
                    className="bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-2xl p-5 mb-6"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        elevation: 8,
                    }}>
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="font-inter-bold text-lg text-gray-900 dark:text-brand-dark-text">Current Plan</Text>
                        {isPaid || isComped ? (
                            <LinearGradient
                                colors={['#BF9A54', '#D4AF37']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, overflow: 'hidden' }}>
                                <Text className="font-inter-bold text-sm text-white">
                                    {subscription?.tier || 'FREE'}
                                </Text>
                            </LinearGradient>
                        ) : (
                            <View className="px-3 py-1 rounded-full bg-gray-200 dark:bg-brand-dark-border">
                                <Text className="font-inter-bold text-sm text-gray-600 dark:text-brand-dark-text-secondary">
                                    {subscription?.tier || 'FREE'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {isComped && comp && (
                        <View className="rounded-xl p-3 mb-4 flex-row items-center">
                            <Ionicons name="gift-outline" size={18} color="#BF9A54" />
                            <Text className="font-inter-medium ml-2 text-brand-gold">
                                Complimentary access
                            </Text>
                            <Text className="font-inter ml-auto text-sm text-gray-500 dark:text-brand-dark-text-muted">
                                Ends {formatDate(comp.expiresAt)}
                            </Text>
                        </View>
                    )}

                    {isPaid && (
                        <View className="rounded-xl p-3 mb-4 flex-row items-center">
                            <Ionicons
                                name={isCancelled ? 'time-outline' : 'checkmark-circle'}
                                size={18}
                                color={isCancelled ? '#EA580C' : '#16A34A'}
                            />
                            <Text
                                className={`font-inter-medium ml-2 ${
                                    isCancelled ? 'text-orange-700' : 'text-green-600'
                                }`}>
                                {isCancelled ? 'Cancelled' : 'Active'}
                            </Text>
                            {subscription?.premiumExpiresAt && (
                                <Text
                                    className={`font-inter ml-auto text-sm ${
                                        isCancelled ? 'text-orange-600' : 'text-gray-500 dark:text-brand-dark-text-muted'
                                    }`}>
                                    {isCancelled ? 'Expires' : 'Renews'}{' '}
                                    {formatDate(subscription.premiumExpiresAt)}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Usage Stats */}
                    {isPaid || isComped ? (
                        /* Paid tiers: unified episode counter */
                        <UsageBar
                            label="Episodes"
                            used={(subscription?.usage.geminiEpisodesUsed ?? 0) + (subscription?.usage.standardEpisodesUsed ?? 0)}
                            limit={subscription?.usage.geminiEpisodeLimit ?? 20}
                        />
                    ) : (
                        /* Free tier: separate Pro + Standard counters */
                        <>
                            <UsageBar
                                label="Pro Episodes"
                                used={subscription?.usage.geminiEpisodesUsed ?? 0}
                                limit={subscription?.usage.geminiEpisodeLimit ?? 1}
                            />
                            <UsageBar
                                label="Standard Episodes"
                                used={subscription?.usage.standardEpisodesUsed ?? 0}
                                limit={subscription?.usage.standardEpisodeLimit ?? 2}
                            />
                        </>
                    )}

                </View>

                {/* Reactivate Button - Show below Current Plan card if cancelled but still active */}
                {isPaid && !isComped && isCancelled && (
                    <TouchableOpacity
                        onPress={handleReactivate}
                        disabled={purchasing}
                        className="overflow-hidden rounded-2xl mb-6"
                        style={{
                            shadowColor: '#BF9A54',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                        }}>
                        <LinearGradient
                            colors={['#BF9A54', '#D4AF37']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="py-4 items-center flex-row justify-center">
                            {purchasing ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={18} color="white" />
                                    <Text className="font-inter-bold text-white ml-2">
                                        Reactivate Subscription
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Pricing Selection - Show if not paid OR comped (cancelled-but-active users use the Reactivate button above) */}
                {(!isPaid || isComped) && (
                    <>
                        <Text className="font-inter-bold text-lg text-gray-900 dark:text-brand-dark-text mb-4">
                            {isComped ? 'Keep Your Access' : isCancelled ? 'Subscribe Again' : 'Choose Your Plan'}
                        </Text>

                        {/* Pricing Cards */}
                        <View className="flex-row gap-3 mb-6">
                            <PricingCard
                                title="Starter"
                                price={subscriptionService.formatPrice(pricing.starter.price)}
                                episodesPerMonth={pricing.starter.episodesPerMonth}
                                isSelected={selectedTier === 'starter'}
                                onSelect={() => {
                                    setSelectedTier('starter');
                                    track('paywall_plan_selected', { tier: 'starter', source: paywallSource });
                                }}
                                disabled={purchasing}
                                icon="rocket-outline"
                            />
                            <PricingCard
                                title="Pro"
                                price={subscriptionService.formatPrice(pricing.pro.price)}
                                episodesPerMonth={pricing.pro.episodesPerMonth}
                                isSelected={selectedTier === 'pro'}
                                onSelect={() => {
                                    setSelectedTier('pro');
                                    track('paywall_plan_selected', { tier: 'pro', source: paywallSource });
                                }}
                                disabled={purchasing}
                                isPopular
                                icon="flash"
                            />
                        </View>

                        {/* Features List */}
                        <View
                            className="bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-2xl p-5 mb-6"
                            style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 10,
                                elevation: 8,
                            }}>
                            <Text className="font-inter-bold text-lg text-gray-900 dark:text-brand-dark-text mb-4">
                                {selectedTier === 'pro' ? 'Pro' : 'Starter'} Features
                            </Text>

                            {pricing[selectedTier].features.map((feature, index) => (
                                <View key={index} className="flex-row items-center py-2.5">
                                    <View className="w-6 h-6 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                                        <Ionicons name="checkmark" size={14} color="#BF9A54" />
                                    </View>
                                    <Text className="font-inter text-gray-700 dark:text-brand-dark-text-secondary flex-1">{feature}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Subscribe Button */}
                        <TouchableOpacity
                            onPress={handleSubscribe}
                            disabled={purchasing}
                            className={`overflow-hidden rounded-2xl mb-4 ${purchasing ? 'opacity-70' : ''}`}
                            style={{
                                shadowColor: '#BF9A54',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 6,
                            }}>
                            <LinearGradient
                                colors={['#BF9A54', '#D4AF37']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="py-4 items-center flex-row justify-center">
                                {purchasing ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="sparkles" size={18} color="white" />
                                        <Text className="font-inter-bold text-white text-base ml-2">
                                            Get {subscriptionService.getTierDisplayName(selectedTier)} -{' '}
                                            {subscriptionService.formatPrice(pricing[selectedTier].price)}/mo
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </>
                )}

                {/* Upgrade Option - Show for STARTER subscribers with an active (non-cancelled) sub */}
                {isPaid && !isComped && subscription?.tier === 'STARTER' && !isCancelled && (
                    <View className="mb-6">
                        <Text className="font-inter-bold text-lg text-gray-900 dark:text-brand-dark-text mb-4">
                            Upgrade Your Plan
                        </Text>
                        <View
                            className="bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-2xl p-5"
                            style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 10,
                                elevation: 8,
                            }}>
                            <View className="flex-row items-center mb-4">
                                <View className="bg-brand-gold/20 w-10 h-10 rounded-xl items-center justify-center mr-3">
                                    <Ionicons name="flash" size={20} color="#BF9A54" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-inter-bold text-lg text-gray-900 dark:text-brand-dark-text">
                                        Upgrade to Pro
                                    </Text>
                                    <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted text-sm">
                                        {pricing.pro.episodesPerMonth} episodes/month
                                    </Text>
                                </View>
                                <Text className="font-inter-bold text-xl text-brand-gold">
                                    {subscriptionService.formatPrice(pricing.pro.price)}
                                    <Text className="text-sm text-gray-500 dark:text-brand-dark-text-muted">/mo</Text>
                                </Text>
                            </View>

                            {/* Pro Features */}
                            <View className="border-t border-black/10 dark:border-white/10 pt-4 mb-4">
                                {pricing.pro.features.map((feature, index) => (
                                    <View key={index} className="flex-row items-center py-2">
                                        <View className="w-5 h-5 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                                            <Ionicons name="checkmark" size={12} color="#BF9A54" />
                                        </View>
                                        <Text className="font-inter text-gray-700 dark:text-brand-dark-text-secondary flex-1 text-sm">{feature}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={handleUpgrade}
                                disabled={purchasing}
                                className="overflow-hidden rounded-xl"
                                style={{
                                    shadowColor: '#BF9A54',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}>
                                <LinearGradient
                                    colors={['#BF9A54', '#D4AF37']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    className="py-3 items-center flex-row justify-center">
                                    <Ionicons name="arrow-up-circle" size={18} color="white" />
                                    <Text className="font-inter-bold text-white ml-2">
                                        Upgrade Now
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Downgrade Option - Show for PRO subscribers with an active (non-cancelled) sub */}
                {isPaid && !isComped && subscription?.tier === 'PRO' && !isCancelled && (
                    <View className="mb-6">
                        <Text className="font-inter-bold text-lg text-gray-900 dark:text-brand-dark-text mb-4">
                            Change Plan
                        </Text>
                        <View
                            className="bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-2xl p-5"
                            style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 10,
                                elevation: 8,
                            }}>
                            <View className="flex-row items-center mb-4">
                                <View className="bg-brand-gold/20 w-10 h-10 rounded-xl items-center justify-center mr-3">
                                    <Ionicons name="rocket-outline" size={20} color="#BF9A54" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-inter-bold text-lg text-gray-900 dark:text-brand-dark-text">
                                        Starter Plan
                                    </Text>
                                    <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted text-sm">
                                        {pricing.starter.episodesPerMonth} episodes/month
                                    </Text>
                                </View>
                                <Text className="font-inter-bold text-xl text-brand-gold">
                                    {subscriptionService.formatPrice(pricing.starter.price)}
                                    <Text className="text-sm text-gray-500 dark:text-brand-dark-text-muted">/mo</Text>
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => {
                                    showAlert({
                                        title: 'Switch to Starter?',
                                        message: 'You will be taken to checkout to subscribe to Starter. Your Pro subscription will be cancelled after payment.',
                                        buttons: [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Continue',
                                                onPress: handleDowngrade,
                                            },
                                        ],
                                    });
                                }}
                                disabled={purchasing}
                                className="bg-brand-gold py-3 rounded-xl items-center flex-row justify-center">
                                <Ionicons name="arrow-down-circle" size={18} color="white" />
                                <Text className="font-inter-bold text-white ml-2">
                                    Switch to Starter
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {isPaid && !isComped && !isCancelled && (
                    <TouchableOpacity
                        onPress={handleCancelSubscription}
                        disabled={purchasing}
                        className={`bg-[#F5F5F0] dark:bg-brand-dark-surface py-4 rounded-2xl items-center mb-4 flex-row justify-center ${
                            purchasing ? 'opacity-70' : ''
                        }`}>
                        {purchasing ? (
                            <ActivityIndicator color="#6B7280" />
                        ) : (
                            <>
                                <Ionicons name="close-circle-outline" size={18} color="#6B7280" />
                                <Text className="font-inter-medium text-gray-600 dark:text-brand-dark-text-secondary text-sm ml-2">
                                    Cancel Subscription
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* Terms */}
                <Text className="font-inter text-gray-400 dark:text-brand-dark-text-muted text-xs text-center px-4 leading-5">
                    {isComped
                        ? `Your complimentary PRO access ends on ${comp ? formatDate(comp.expiresAt) : 'the expiry date'}. Subscribe anytime to keep your access uninterrupted.`
                        : isPaid
                          ? isCancelled
                              ? 'Your subscription is cancelled but you still have access until the end of your billing period. Reactivate anytime to continue your subscription.'
                              : 'Your subscription renews automatically. You can cancel anytime from this screen.'
                          : 'By subscribing, you agree to our Terms of Service. Subscription automatically renews unless cancelled.'}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
