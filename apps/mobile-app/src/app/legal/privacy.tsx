import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicy() {
    return (
        <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
            {/* Header */}
            <View className="flex-row items-center px-5 py-4 border-b border-gray-200 dark:border-brand-dark-border">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color="#2F2F2F" />
                </TouchableOpacity>
                <Text className="font-inter-bold text-xl text-brand-black dark:text-brand-dark-text">Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted text-sm mb-6">
                    Last updated: February 2026
                </Text>

                <Section title="1. Information We Collect">
                    <Text className="font-inter-medium text-sm text-brand-black dark:text-brand-dark-text mb-1">Account Information</Text>
                    {'\n'}When you create an account, we collect your name, email address, date of birth (optional), and password (stored securely using encryption).

                    {'\n\n'}<Text className="font-inter-medium text-sm text-brand-black dark:text-brand-dark-text mb-1">Usage Data</Text>
                    {'\n'}We collect information about how you use the app, including episodes generated, playback activity, AI podcaster configurations, social interactions (comments, likes, ratings), and feature usage to improve our service.

                    {'\n\n'}<Text className="font-inter-medium text-sm text-brand-black dark:text-brand-dark-text mb-1">Device Information</Text>
                    {'\n'}We may collect device type, operating system, and push notification tokens to deliver notifications and optimise the app experience.

                    {'\n\n'}<Text className="font-inter-medium text-sm text-brand-black dark:text-brand-dark-text mb-1">User-Generated Content</Text>
                    {'\n'}We collect and store content you create on the platform, including AI podcaster configurations, comments, ratings, and other social interactions.
                </Section>

                <Section title="2. How We Use Your Information">
                    We use your information to:{'\n'}
                    {'\u2022'} Provide and maintain the Auditure service{'\n'}
                    {'\u2022'} Process your subscription and payments{'\n'}
                    {'\u2022'} Generate AI audio episodes from your uploaded content{'\n'}
                    {'\u2022'} Display your AI podcasters, comments, and ratings to other users through social features{'\n'}
                    {'\u2022'} Send you notifications about your episodes, social interactions, and account{'\n'}
                    {'\u2022'} Improve and personalise your experience{'\n'}
                    {'\u2022'} Respond to your enquiries and support requests{'\n'}
                    {'\u2022'} Ensure the security and integrity of the platform{'\n'}
                    {'\u2022'} Enforce our Terms of Service and respond to copyright claims
                </Section>

                <Section title="3. Content You Upload">
                    Books and text you upload are processed solely to generate audio episodes. Your uploaded content is stored securely and used only for providing the service to you. We do not use your uploaded content to train AI models. We do not share your uploaded source material with other users or third parties.{'\n\n'}
                    AI-generated episodes derived from your uploads may be visible to other users through the platform's social features (feed, discovery). The original uploaded source material (book text) is never shared or made accessible to other users.
                </Section>

                <Section title="4. AI Podcaster Data">
                    When you create an AI podcaster, we store the configuration details (name, voice, style, personality settings) and associate it with your account. Your AI podcaster profiles and the episodes they generate may be visible to other users through the platform's social features, including the feed, search, and discovery.
                </Section>

                <Section title="5. Social Features & Community Data">
                    Auditure includes social features such as a feed, comments, likes, and ratings. When you use these features:{'\n\n'}
                    {'\u2022'} Your comments, likes, and ratings are visible to other users{'\n'}
                    {'\u2022'} Your profile name and AI podcasters are visible on the platform{'\n'}
                    {'\u2022'} Your social interactions may appear in other users' feeds{'\n\n'}
                    You can manage your social presence through your profile settings.
                </Section>

                <Section title="6. Payment Information">
                    Payments are processed securely through Paystack. We do not store your full payment card details. Paystack handles all payment data in compliance with PCI DSS standards. We retain only subscription status and transaction references.
                </Section>

                <Section title="7. Data Sharing">
                    We do not sell your personal information. We may share limited data with:{'\n'}
                    {'\u2022'} <Text className="font-inter-medium">Paystack</Text> — for payment processing{'\n'}
                    {'\u2022'} <Text className="font-inter-medium">Google Cloud</Text> — for AI processing, audio generation, and hosting{'\n'}
                    {'\u2022'} <Text className="font-inter-medium">OpenAI</Text> — for AI script generation (text content is sent for processing; we do not opt in to training){'\n'}
                    {'\u2022'} <Text className="font-inter-medium">Sentry</Text> — for error tracking and app stability{'\n'}
                    {'\u2022'} <Text className="font-inter-medium">Firebase</Text> — for push notifications{'\n\n'}
                    These providers are bound by their own privacy policies and data protection obligations.{'\n\n'}
                    We may also disclose information if required by law, legal process, or to respond to valid copyright takedown requests.
                </Section>

                <Section title="8. Data Storage & Security">
                    Your data is stored on secure servers. We implement industry-standard security measures including encryption in transit and at rest. While we strive to protect your data, no method of electronic storage is 100% secure.
                </Section>

                <Section title="9. Your Rights">
                    You have the right to:{'\n'}
                    {'\u2022'} Access your personal data through your profile{'\n'}
                    {'\u2022'} Update or correct your information{'\n'}
                    {'\u2022'} Delete your account and associated data (including AI podcasters, comments, and generated content){'\n'}
                    {'\u2022'} Export your data upon request{'\n'}
                    {'\u2022'} Opt out of non-essential notifications{'\n'}
                    {'\u2022'} Request removal of specific comments or social content you have posted{'\n\n'}
                    To exercise these rights, use the in-app settings or contact us at support@auditure.com.
                </Section>

                <Section title="10. Account & Data Deletion">
                    You can delete your Auditure account and all associated data at any time. To delete your account:{'\n\n'}
                    1. Open the Auditure app{'\n'}
                    2. Go to the <Text className="font-inter-medium">Profile</Text> tab{'\n'}
                    3. Scroll down and tap <Text className="font-inter-medium">"Delete Account"</Text>{'\n'}
                    4. Enter your password to confirm{'\n'}
                    5. Your account will be permanently deleted{'\n\n'}
                    <Text className="font-inter-medium">What gets deleted:</Text>{'\n'}
                    {'\u2022'} Your account and personal information (name, email, date of birth){'\n'}
                    {'\u2022'} All AI podcasters you created{'\n'}
                    {'\u2022'} All generated audio episodes{'\n'}
                    {'\u2022'} All comments, likes, and ratings{'\n'}
                    {'\u2022'} Your subscription (if active, it will be cancelled){'\n'}
                    {'\u2022'} Uploaded book content{'\n\n'}
                    Account deletion is permanent and cannot be undone. We may retain anonymised, aggregated data for analytics purposes.{'\n\n'}
                    If you are unable to access the app, you can request account deletion by emailing support@auditure.com from the email address associated with your account.
                </Section>

                <Section title="11. Data Retention">
                    We retain your data for as long as your account is active. When you delete your account, your data is permanently removed as described in Section 10. We may retain anonymised, aggregated data for analytics purposes.
                </Section>

                <Section title="12. Children's Privacy">
                    Auditure is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us.
                </Section>

                <Section title="13. Changes to This Policy">
                    We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or via email. The "Last updated" date at the top indicates when this policy was last revised.
                </Section>

                <Section title="14. Contact Us">
                    If you have questions or concerns about this Privacy Policy or how we handle your data, please contact us at support@auditure.com.
                </Section>
            </ScrollView>
        </SafeAreaView>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View className="mb-6">
            <Text className="font-inter-bold text-base text-brand-black dark:text-brand-dark-text mb-2">{title}</Text>
            <Text className="font-inter text-sm text-gray-700 dark:text-brand-dark-text-secondary leading-5">{children}</Text>
        </View>
    );
}
