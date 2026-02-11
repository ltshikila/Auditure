import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsOfService() {
    return (
        <SafeAreaView className="flex-1 bg-brand-beige">
            {/* Header */}
            <View className="flex-row items-center px-5 py-4 border-b border-gray-200">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color="#2F2F2F" />
                </TouchableOpacity>
                <Text className="font-inter-bold text-xl text-brand-black">Terms of Service</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <Text className="font-inter text-gray-500 text-sm mb-6">
                    Last updated: February 2026
                </Text>

                <Section title="1. Acceptance of Terms">
                    By creating an account or using Auditure, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.
                </Section>

                <Section title="2. Description of Service">
                    Auditure is an AI-powered platform that converts books and written content into podcast-style audio episodes. The service includes content generation, audio playback, and related features available through our mobile application.
                </Section>

                <Section title="3. User Accounts">
                    You must be at least 13 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration.
                </Section>

                <Section title="4. Subscriptions & Payments">
                    Auditure offers free and paid subscription tiers. Paid subscriptions are billed monthly through Paystack. Subscriptions automatically renew unless cancelled before the end of the current billing period. Cancellation takes effect at the end of your current billing cycle — you retain access until then.
                </Section>

                <Section title="5. Content & Intellectual Property">
                    You retain ownership of any content you upload to Auditure. By uploading content, you grant Auditure a limited licence to process and convert it into audio format for your personal use. AI-generated audio episodes are provided for your personal, non-commercial use. You may not redistribute, resell, or publicly broadcast generated content without prior written consent.
                </Section>

                <Section title="6. Acceptable Use">
                    You agree not to:{'\n'}
                    {'\u2022'} Upload content that infringes on copyright or intellectual property rights{'\n'}
                    {'\u2022'} Use the service for illegal or harmful purposes{'\n'}
                    {'\u2022'} Attempt to reverse-engineer, hack, or disrupt the service{'\n'}
                    {'\u2022'} Create multiple accounts to circumvent usage limits{'\n'}
                    {'\u2022'} Share your account credentials with others
                </Section>

                <Section title="7. Usage Limits">
                    Each subscription tier includes monthly episode generation limits. Usage resets at the start of each billing cycle. Auditure reserves the right to modify usage limits with reasonable notice.
                </Section>

                <Section title="8. Termination">
                    We may suspend or terminate your account if you violate these terms. You may delete your account at any time through the app settings. Upon account deletion, your data will be permanently removed in accordance with our Privacy Policy.
                </Section>

                <Section title="9. Disclaimers">
                    Auditure is provided "as is" without warranties of any kind. AI-generated audio may contain inaccuracies or imperfections. We do not guarantee uninterrupted or error-free service.
                </Section>

                <Section title="10. Limitation of Liability">
                    To the maximum extent permitted by law, Auditure shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
                </Section>

                <Section title="11. Changes to Terms">
                    We may update these terms from time to time. We will notify you of significant changes through the app or via email. Continued use of the service after changes constitutes acceptance of the updated terms.
                </Section>

                <Section title="12. Contact">
                    If you have questions about these Terms of Service, please contact us at support@auditure.com.
                </Section>
            </ScrollView>
        </SafeAreaView>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View className="mb-6">
            <Text className="font-inter-bold text-base text-brand-black mb-2">{title}</Text>
            <Text className="font-inter text-sm text-gray-700 leading-5">{children}</Text>
        </View>
    );
}
