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
                    Auditure is an AI-powered platform where users create virtual AI podcasters and convert books and written content into podcast-style audio episodes. The service includes AI podcaster creation and customisation, audio episode generation, social features (feed, comments, likes, ratings), and related features available through our mobile application.
                </Section>

                <Section title="3. User Accounts">
                    You must be at least 13 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration.
                </Section>

                <Section title="4. Subscriptions & Payments">
                    Auditure offers free and paid subscription tiers. Paid subscriptions are billed monthly through Paystack. Subscriptions automatically renew unless cancelled before the end of the current billing period. Cancellation takes effect at the end of your current billing cycle — you retain access until then.
                </Section>

                <Section title="5. User-Uploaded Content & Copyright">
                    You are solely responsible for all content you upload to Auditure, including books, text, and other materials. By uploading content, you represent and warrant that:{'\n\n'}
                    {'\u2022'} You own or have the legal right to use the content you upload{'\n'}
                    {'\u2022'} Your use of the content does not infringe on the copyright, intellectual property, or other rights of any third party{'\n'}
                    {'\u2022'} You have obtained all necessary permissions, licences, or authorisations required to upload and process the content{'\n\n'}
                    Auditure does not verify the ownership or legality of user-uploaded content. You assume full responsibility and liability for any content you upload and any consequences arising from its use. Auditure is not liable for any copyright infringement or legal claims resulting from user-uploaded content.
                </Section>

                <Section title="6. Copyright Infringement & DMCA">
                    Auditure respects the intellectual property rights of others. If you believe that content on Auditure infringes your copyright, you may submit a takedown notice to support@auditure.com containing:{'\n\n'}
                    {'\u2022'} A description of the copyrighted work you believe has been infringed{'\n'}
                    {'\u2022'} A description of the material you believe is infringing and its location on the platform{'\n'}
                    {'\u2022'} Your contact information (name, address, email, phone number){'\n'}
                    {'\u2022'} A statement that you have a good faith belief that the use is not authorised by the copyright owner{'\n'}
                    {'\u2022'} A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorised to act on their behalf{'\n'}
                    {'\u2022'} Your physical or electronic signature{'\n\n'}
                    We will review and respond to valid takedown requests in a timely manner. Users who repeatedly infringe copyright may have their accounts suspended or terminated.
                </Section>

                <Section title="7. AI-Generated Content">
                    Auditure uses AI to generate audio episodes based on user-uploaded content. AI-generated episodes are transformative works that may include lectures, discussions, summaries, and commentary derived from the source material — they are not verbatim reproductions.{'\n\n'}
                    AI-generated audio may contain inaccuracies, interpretive differences, or imperfections. Auditure does not guarantee the accuracy or completeness of AI-generated content. Generated episodes are provided for your personal, non-commercial use. You may not redistribute, resell, or publicly broadcast generated content without prior written consent.
                </Section>

                <Section title="8. AI Podcasters (Virtual Podcasters)">
                    Users may create and customise AI podcaster personalities on Auditure. By creating an AI podcaster, you agree that:{'\n\n'}
                    {'\u2022'} You will not create AI podcasters that impersonate real individuals without their consent{'\n'}
                    {'\u2022'} You will not use AI podcasters to generate harmful, misleading, defamatory, or illegal content{'\n'}
                    {'\u2022'} Auditure may remove AI podcasters or generated content that violates these terms or applicable law{'\n\n'}
                    AI podcasters you create may be visible to other users on the platform through the social feed and discovery features.
                </Section>

                <Section title="9. Community & Social Features">
                    Auditure includes social features such as a feed, comments, likes, and ratings. By using these features, you agree to:{'\n\n'}
                    {'\u2022'} Treat other users with respect{'\n'}
                    {'\u2022'} Not post spam, harassment, hate speech, or abusive content{'\n'}
                    {'\u2022'} Not use the platform to promote illegal activities{'\n'}
                    {'\u2022'} Not attempt to manipulate ratings, likes, or other engagement metrics{'\n\n'}
                    Auditure reserves the right to remove any user-generated content (comments, ratings, etc.) that violates these terms, and to suspend or terminate accounts engaged in abusive behaviour.
                </Section>

                <Section title="10. Acceptable Use">
                    You agree not to:{'\n'}
                    {'\u2022'} Upload content that you do not have the legal right to use{'\n'}
                    {'\u2022'} Use the service for illegal or harmful purposes{'\n'}
                    {'\u2022'} Attempt to reverse-engineer, hack, or disrupt the service{'\n'}
                    {'\u2022'} Create multiple accounts to circumvent usage limits{'\n'}
                    {'\u2022'} Share your account credentials with others{'\n'}
                    {'\u2022'} Use automated tools or bots to access the service{'\n'}
                    {'\u2022'} Scrape, collect, or harvest content or user data from the platform
                </Section>

                <Section title="11. Usage Limits">
                    Each subscription tier includes monthly episode generation limits. Usage resets at the start of each billing cycle. Auditure reserves the right to modify usage limits with reasonable notice.
                </Section>

                <Section title="12. Termination">
                    We may suspend or terminate your account if you violate these terms, including but not limited to repeated copyright infringement, abusive behaviour, or fraudulent activity. You may delete your account at any time through the app settings. Upon account deletion, your data will be permanently removed in accordance with our Privacy Policy.
                </Section>

                <Section title="13. Disclaimers">
                    Auditure is provided "as is" without warranties of any kind. AI-generated audio may contain inaccuracies or imperfections. We do not guarantee uninterrupted or error-free service. Auditure is not responsible for the accuracy, legality, or quality of user-uploaded content or AI-generated output.
                </Section>

                <Section title="14. Limitation of Liability">
                    To the maximum extent permitted by law, Auditure shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including but not limited to damages arising from user-uploaded content, AI-generated output, or interactions with other users on the platform.
                </Section>

                <Section title="15. Changes to Terms">
                    We may update these terms from time to time. We will notify you of significant changes through the app or via email. Continued use of the service after changes constitutes acceptance of the updated terms.
                </Section>

                <Section title="16. Contact">
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
