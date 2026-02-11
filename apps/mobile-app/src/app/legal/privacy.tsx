import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicy() {
    return (
        <SafeAreaView className="flex-1 bg-brand-beige">
            {/* Header */}
            <View className="flex-row items-center px-5 py-4 border-b border-gray-200">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color="#2F2F2F" />
                </TouchableOpacity>
                <Text className="font-inter-bold text-xl text-brand-black">Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <Text className="font-inter text-gray-500 text-sm mb-6">
                    Last updated: February 2026
                </Text>

                <Section title="1. Information We Collect">
                    <Text className="font-inter-medium text-sm text-brand-black mb-1">Account Information</Text>
                    {'\n'}When you create an account, we collect your name, email address, date of birth (optional), and password (stored securely using encryption).

                    {'\n\n'}<Text className="font-inter-medium text-sm text-brand-black mb-1">Usage Data</Text>
                    {'\n'}We collect information about how you use the app, including episodes generated, playback activity, and feature usage to improve our service.

                    {'\n\n'}<Text className="font-inter-medium text-sm text-brand-black mb-1">Device Information</Text>
                    {'\n'}We may collect device type, operating system, and push notification tokens to deliver notifications and optimise the app experience.
                </Section>

                <Section title="2. How We Use Your Information">
                    We use your information to:{'\n'}
                    {'\u2022'} Provide and maintain the Auditure service{'\n'}
                    {'\u2022'} Process your subscription and payments{'\n'}
                    {'\u2022'} Send you notifications about your episodes and account{'\n'}
                    {'\u2022'} Improve and personalise your experience{'\n'}
                    {'\u2022'} Respond to your enquiries and support requests{'\n'}
                    {'\u2022'} Ensure the security and integrity of the platform
                </Section>

                <Section title="3. Content You Upload">
                    Books and text you upload are processed to generate audio episodes. Your uploaded content is stored securely and used solely for providing the service to you. We do not use your uploaded content to train AI models or share it with third parties.
                </Section>

                <Section title="4. Payment Information">
                    Payments are processed securely through Paystack. We do not store your full payment card details. Paystack handles all payment data in compliance with PCI DSS standards. We retain only subscription status and transaction references.
                </Section>

                <Section title="5. Data Sharing">
                    We do not sell your personal information. We may share limited data with:{'\n'}
                    {'\u2022'} <Text className="font-inter-medium">Paystack</Text> — for payment processing{'\n'}
                    {'\u2022'} <Text className="font-inter-medium">Google Cloud</Text> — for audio generation and hosting{'\n'}
                    {'\u2022'} <Text className="font-inter-medium">Sentry</Text> — for error tracking and app stability{'\n\n'}
                    These providers are bound by their own privacy policies and data protection obligations.
                </Section>

                <Section title="6. Data Storage & Security">
                    Your data is stored on secure servers. We implement industry-standard security measures including encryption in transit and at rest. While we strive to protect your data, no method of electronic storage is 100% secure.
                </Section>

                <Section title="7. Your Rights">
                    You have the right to:{'\n'}
                    {'\u2022'} Access your personal data through your profile{'\n'}
                    {'\u2022'} Update or correct your information{'\n'}
                    {'\u2022'} Delete your account and associated data{'\n'}
                    {'\u2022'} Export your data upon request{'\n'}
                    {'\u2022'} Opt out of non-essential notifications{'\n\n'}
                    To exercise these rights, use the in-app settings or contact us at support@auditure.com.
                </Section>

                <Section title="8. Data Retention">
                    We retain your data for as long as your account is active. When you delete your account, your personal data and generated content are permanently removed. We may retain anonymised, aggregated data for analytics purposes.
                </Section>

                <Section title="9. Children's Privacy">
                    Auditure is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us.
                </Section>

                <Section title="10. Changes to This Policy">
                    We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or via email. The "Last updated" date at the top indicates when this policy was last revised.
                </Section>

                <Section title="11. Contact Us">
                    If you have questions or concerns about this Privacy Policy or how we handle your data, please contact us at support@auditure.com.
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
