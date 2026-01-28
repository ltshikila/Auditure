import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { storageService } from '@/services/storage.service';
import {
    subscriptionService,
    StripeSubscriptionStatus,
    BillingInterval,
    Pricing,
} from '@/services/subscription.service';
import { TopBar } from '@/components';

type PricingCardProps = {
    title: string;
    price: string;
    interval: string;
    savings?: string | null;
    monthlyEquivalent?: string;
    isSelected: boolean;
    onSelect: () => void;
    disabled?: boolean;
};

function PricingCard({
    title,
    price,
    interval,
    savings,
    monthlyEquivalent,
    isSelected,
    onSelect,
    disabled,
}: PricingCardProps) {
    return (
        <TouchableOpacity
            onPress={onSelect}
            disabled={disabled}
            className={`flex-1 p-4 rounded-2xl border-2 ${
                isSelected ? 'border-brand-gold bg-brand-gold/10' : 'border-gray-200 bg-white'
            } ${disabled ? 'opacity-50' : ''}`}
            style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
            }}>
            {savings && (
                <View className="bg-brand-gold px-2 py-1 rounded-full self-start mb-2">
                    <Text className="font-inter-medium text-white text-xs">{savings}</Text>
                </View>
            )}
            <Text className="font-inter-bold text-lg text-gray-900">{title}</Text>
            <View className="flex-row items-baseline mt-2">
                <Text className="font-inter-bold text-2xl text-brand-gold">{price}</Text>
                <Text className="font-inter text-gray-500 ml-1">/{interval}</Text>
            </View>
            {monthlyEquivalent && (
                <Text className="font-inter text-gray-500 text-sm mt-1">
                    {monthlyEquivalent}/mo
                </Text>
            )}
            <View
                className={`w-5 h-5 rounded-full border-2 mt-3 items-center justify-center ${
                    isSelected ? 'border-brand-gold bg-brand-gold' : 'border-gray-300'
                }`}>
                {isSelected && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
        </TouchableOpacity>
    );
}

export default function SubscriptionScreen() {
    const [subscription, setSubscription] = useState<StripeSubscriptionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('year');

    const pricing: Pricing = subscriptionService.getPricing();

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

            const data = await subscriptionService.getStripeSubscriptionStatus(token);
            setSubscription(data);
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

    const handleSubscribe = async () => {
        try {
            setPurchasing(true);
            setError(null);

            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            const result = await subscriptionService.startCheckout(token, selectedInterval);

            if (result.success) {
                Alert.alert(
                    'Subscription Activated!',
                    'Welcome to Auditure Premium! Enjoy unlimited podcast episodes.',
                    [{ text: 'OK', onPress: () => fetchSubscription() }],
                );
            } else if (result.cancelled) {
                // User cancelled, no alert needed
                console.log('User cancelled checkout');
            } else if (result.error) {
                setError(result.error);
            }
        } catch (err: any) {
            console.error('Subscription error:', err);
            setError(err.message || 'Failed to start subscription');
        } finally {
            setPurchasing(false);
        }
    };

    const handleManageSubscription = async () => {
        try {
            setPurchasing(true);
            setError(null);

            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            await subscriptionService.openCustomerPortal(token);
            // Refresh subscription status after returning from portal
            await fetchSubscription();
        } catch (err: any) {
            console.error('Portal error:', err);
            Alert.alert('Error', err.message || 'Failed to open subscription portal');
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
            <SafeAreaView
                className="flex-1 bg-brand-beige items-center justify-center"
                edges={['top', 'left', 'right']}>
                <ActivityIndicator size="large" color="#BF9A54" />
                <Text className="font-inter text-gray-500 mt-4">Loading subscription...</Text>
            </SafeAreaView>
        );
    }

    const isPremium = subscription?.isPremium ?? false;
    const stripeStatus = subscription?.stripeSubscription;

    return (
        <SafeAreaView className="flex-1 bg-brand-beige" edges={['top', 'left', 'right']}>
            <TopBar showBack onBack={() => router.back()} />

            <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#BF9A54"
                    />
                }>
                {/* Header */}
                <View className="mb-6">
                    <Text className="font-inter-bold text-2xl text-brand-black">
                        {isPremium ? 'Your Subscription' : 'Upgrade to Premium'}
                    </Text>
                    <Text className="font-jakarta text-gray-600 mt-1">
                        {isPremium
                            ? 'Manage your premium subscription'
                            : 'Unlock unlimited podcast episodes from your books'}
                    </Text>
                </View>

                {/* Error Message */}
                {error && (
                    <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                        <Text className="font-inter text-red-800">{error}</Text>
                        <TouchableOpacity onPress={() => fetchSubscription()} className="mt-2">
                            <Text className="font-inter-medium text-red-600">Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Current Status Card */}
                <View
                    className="bg-white rounded-2xl p-5 mb-6"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        elevation: 8,
                    }}>
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="font-inter-bold text-lg text-gray-900">Current Plan</Text>
                        <View
                            className={`px-3 py-1 rounded-full ${
                                isPremium ? 'bg-brand-gold' : 'bg-gray-200'
                            }`}>
                            <Text
                                className={`font-inter-bold text-sm ${
                                    isPremium ? 'text-white' : 'text-gray-700'
                                }`}>
                                {subscription?.tier || 'FREE'}
                            </Text>
                        </View>
                    </View>

                    {isPremium && stripeStatus && (
                        <View className="space-y-2">
                            <View className="flex-row justify-between">
                                <Text className="font-inter text-gray-500">Status</Text>
                                <Text className="font-inter-medium text-gray-900 capitalize">
                                    {stripeStatus.status}
                                </Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="font-inter text-gray-500">Renews</Text>
                                <Text className="font-inter-medium text-gray-900">
                                    {formatDate(stripeStatus.currentPeriodEnd)}
                                </Text>
                            </View>
                            {stripeStatus.cancelAtPeriodEnd && (
                                <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                                    <Text className="font-inter text-amber-800">
                                        Your subscription will end on{' '}
                                        {formatDate(stripeStatus.currentPeriodEnd)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {!isPremium && (
                        <View className="space-y-2">
                            <View className="flex-row justify-between">
                                <Text className="font-inter text-gray-500">Gemini Episodes</Text>
                                <Text className="font-inter-medium text-gray-900">
                                    {subscription?.usage.geminiEpisodesUsed ?? 0} /{' '}
                                    {subscription?.usage.geminiEpisodeLimit ?? 1} per month
                                </Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="font-inter text-gray-500">Standard Episodes</Text>
                                <Text className="font-inter-medium text-gray-900">
                                    {subscription?.usage.standardEpisodesUsed ?? 0} /{' '}
                                    {subscription?.usage.standardEpisodeLimit ?? 2} per month
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Premium Features */}
                {!isPremium && (
                    <View
                        className="bg-white rounded-2xl p-5 mb-6"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                        <Text className="font-inter-bold text-lg text-gray-900 mb-4">
                            Premium Benefits
                        </Text>

                        {[
                            {
                                icon: 'infinite',
                                title: 'Unlimited Episodes',
                                desc: 'Create as many podcast episodes as you want',
                            },
                            {
                                icon: 'mic',
                                title: 'Premium Voice Quality',
                                desc: 'Access to Gemini multi-speaker TTS',
                            },
                            {
                                icon: 'flash',
                                title: 'Priority Processing',
                                desc: 'Your episodes are processed faster',
                            },
                            {
                                icon: 'headset',
                                title: 'Priority Support',
                                desc: 'Get help when you need it',
                            },
                        ].map((feature, index) => (
                            <View key={index} className="flex-row items-start mb-4 last:mb-0">
                                <View className="w-10 h-10 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                                    <Ionicons
                                        name={feature.icon as any}
                                        size={20}
                                        color="#BF9A54"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-inter-medium text-gray-900">
                                        {feature.title}
                                    </Text>
                                    <Text className="font-inter text-gray-500 text-sm">
                                        {feature.desc}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Pricing Selection */}
                {!isPremium && (
                    <View className="mb-6">
                        <Text className="font-inter-bold text-lg text-gray-900 mb-4">
                            Choose Your Plan
                        </Text>

                        <View className="flex-row gap-3">
                            <PricingCard
                                title="Monthly"
                                price={subscriptionService.formatPrice(pricing.monthly.price)}
                                interval="month"
                                isSelected={selectedInterval === 'month'}
                                onSelect={() => setSelectedInterval('month')}
                                disabled={purchasing}
                            />
                            <PricingCard
                                title="Yearly"
                                price={subscriptionService.formatPrice(pricing.yearly.price)}
                                interval="year"
                                savings={pricing.yearly.savings}
                                monthlyEquivalent={
                                    pricing.yearly.monthlyEquivalent
                                        ? subscriptionService.formatPrice(
                                              pricing.yearly.monthlyEquivalent,
                                          )
                                        : undefined
                                }
                                isSelected={selectedInterval === 'year'}
                                onSelect={() => setSelectedInterval('year')}
                                disabled={purchasing}
                            />
                        </View>
                    </View>
                )}

                {/* Subscribe Button */}
                {!isPremium && (
                    <TouchableOpacity
                        onPress={handleSubscribe}
                        disabled={purchasing}
                        className={`bg-brand-gold py-4 rounded-xl items-center mb-4 ${
                            purchasing ? 'opacity-70' : ''
                        }`}
                        style={{
                            shadowColor: '#BF9A54',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4,
                        }}>
                        {purchasing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="font-inter-bold text-white text-lg">
                                Subscribe Now
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                {/* Manage Subscription Button */}
                {isPremium && (
                    <TouchableOpacity
                        onPress={handleManageSubscription}
                        disabled={purchasing}
                        className={`bg-brand-gold py-4 rounded-xl items-center mb-4 ${
                            purchasing ? 'opacity-70' : ''
                        }`}
                        style={{
                            shadowColor: '#BF9A54',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4,
                        }}>
                        {purchasing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="font-inter-bold text-white text-lg">
                                Manage Subscription
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                {/* Terms */}
                <Text className="font-inter text-gray-400 text-xs text-center px-4">
                    {isPremium
                        ? 'Manage your subscription, update payment method, or cancel anytime through the Customer Portal.'
                        : 'By subscribing, you agree to our Terms of Service. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.'}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
