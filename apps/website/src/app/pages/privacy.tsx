import { Link } from "react-router";
import appLogo from 'figma:asset/9d4b5c5fc52fec774c788c231ec86fca8166a560.png';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FBF8F2]">
      {/* Header */}
      <header className="bg-[#FBF8F2] border-b border-[#2f2f2f]/10 sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={appLogo} alt="Auditure" className="w-8 h-8" />
            <span className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-xl">Auditure</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#2f2f2f] text-4xl md:text-5xl mb-2">
          Privacy Policy
        </h1>
        <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-sm mb-10">
          Last updated: February 2026
        </p>

        <Section title="1. Information We Collect">
          <p className="mb-3"><strong>Account Information</strong></p>
          <p className="mb-3">When you create an account, we collect your name, email address, date of birth (optional), and password (stored securely using encryption).</p>

          <p className="mb-3"><strong>Usage Data</strong></p>
          <p className="mb-3">We collect information about how you use the app, including episodes generated, playback activity, Virtual Podcaster configurations, social interactions (comments, likes, ratings), and feature usage to improve our service.</p>

          <p className="mb-3"><strong>Device Information</strong></p>
          <p className="mb-3">We may collect device type, operating system, and push notification tokens to deliver notifications and optimise the app experience.</p>

          <p className="mb-3"><strong>User-Generated Content</strong></p>
          <p>We collect and store content you create on the platform, including Virtual Podcaster configurations, comments, ratings, and other social interactions.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p className="mb-3">We use your information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and maintain the Auditure service</li>
            <li>Process your subscription and payments</li>
            <li>Generate AI audio episodes from your uploaded content</li>
            <li>Display your Virtual Podcasters, comments, and ratings to other users through social features</li>
            <li>Send you notifications about your episodes, social interactions, and account</li>
            <li>Improve and personalise your experience</li>
            <li>Respond to your enquiries and support requests</li>
            <li>Ensure the security and integrity of the platform</li>
            <li>Enforce our Terms of Service and respond to copyright claims</li>
          </ul>
        </Section>

        <Section title="3. Content You Upload">
          <p className="mb-3">Books and text you upload are processed solely to generate audio episodes. Your uploaded content is stored securely and used only for providing the service to you. We do not use your uploaded content to train AI models. We do not share your uploaded source material with other users or third parties.</p>
          <p>AI-generated episodes derived from your uploads may be visible to other users through the platform's social features (feed, discovery). The original uploaded source material (book text) is never shared or made accessible to other users.</p>
        </Section>

        <Section title="4. Virtual Podcaster Data">
          <p>When you create a Virtual Podcaster, we store the configuration details (name, voice, style, personality settings) and associate it with your account. Your Virtual Podcaster profiles and the episodes they generate may be visible to other users through the platform's social features, including the feed, search, and discovery.</p>
        </Section>

        <Section title="5. Social Features & Community Data">
          <p className="mb-3">Auditure includes social features such as a feed, comments, likes, and ratings. When you use these features:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>Your comments, likes, and ratings are visible to other users</li>
            <li>Your profile name and Virtual Podcasters are visible on the platform</li>
            <li>Your social interactions may appear in other users' feeds</li>
          </ul>
          <p>You can manage your social presence through your profile settings.</p>
        </Section>

        <Section title="6. Payment Information">
          <p>Payments are processed securely through Paystack. We do not store your full payment card details. Paystack handles all payment data in compliance with PCI DSS standards. We retain only subscription status and transaction references.</p>
        </Section>

        <Section title="7. Data Sharing">
          <p className="mb-3">We do not sell your personal information. We may share limited data with:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li><strong>Paystack</strong> - for payment processing</li>
            <li><strong>Google Cloud</strong> - for AI processing, audio generation, and hosting</li>
            <li><strong>OpenAI</strong> - for AI script generation (text content is sent for processing; we do not opt in to training)</li>
            <li><strong>Sentry</strong> - for error tracking and app stability</li>
            <li><strong>Firebase</strong> - for push notifications</li>
          </ul>
          <p className="mb-3">These providers are bound by their own privacy policies and data protection obligations.</p>
          <p>We may also disclose information if required by law, legal process, or to respond to valid copyright takedown requests.</p>
        </Section>

        <Section title="8. Data Storage & Security">
          <p>Your data is stored on secure servers. We implement industry-standard security measures including encryption in transit and at rest. While we strive to protect your data, no method of electronic storage is 100% secure.</p>
        </Section>

        <Section title="9. Your Rights">
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>Access your personal data through your profile</li>
            <li>Update or correct your information</li>
            <li>Delete your account and associated data (including Virtual Podcasters, comments, and generated content)</li>
            <li>Export your data upon request</li>
            <li>Opt out of non-essential notifications</li>
            <li>Request removal of specific comments or social content you have posted</li>
          </ul>
          <p>To exercise these rights, use the in-app settings or contact us at <a href="mailto:support@auditure.com" className="text-[#920002] hover:underline">support@auditure.com</a>.</p>
        </Section>

        <Section title="10. Account & Data Deletion">
          <p className="mb-3">You can delete your Auditure account and all associated data at any time. To delete your account:</p>
          <ol className="list-decimal pl-5 space-y-1 mb-3">
            <li>Open the Auditure app</li>
            <li>Go to the <strong>Profile</strong> tab</li>
            <li>Scroll down and tap <strong>"Delete Account"</strong></li>
            <li>Enter your password to confirm</li>
            <li>Your account will be permanently deleted</li>
          </ol>
          <p className="mb-3"><strong>What gets deleted:</strong></p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>Your account and personal information (name, email, date of birth)</li>
            <li>All Virtual Podcasters you created</li>
            <li>All generated audio episodes</li>
            <li>All comments, likes, and ratings</li>
            <li>Your subscription (if active, it will be cancelled)</li>
            <li>Uploaded book content</li>
          </ul>
          <p className="mb-3">Account deletion is <strong>permanent and cannot be undone</strong>. We may retain anonymised, aggregated data for analytics purposes.</p>
          <p>If you are unable to access the app, you can request account deletion by emailing <a href="mailto:support@auditure.com" className="text-[#920002] hover:underline">support@auditure.com</a> from the email address associated with your account.</p>
        </Section>

        <Section title="11. Data Retention">
          <p>We retain your data for as long as your account is active. When you delete your account, your data is permanently removed as described in Section 10. We may retain anonymised, aggregated data for analytics purposes.</p>
        </Section>

        <Section title="12. Children's Privacy">
          <p>Auditure is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us.</p>
        </Section>

        <Section title="13. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or via email. The "Last updated" date at the top indicates when this policy was last revised.</p>
        </Section>

        <Section title="14. Contact Us">
          <p>If you have questions or concerns about this Privacy Policy or how we handle your data, please contact us at <a href="mailto:support@auditure.com" className="text-[#920002] hover:underline">support@auditure.com</a>.</p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="bg-[#191815] py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/40 text-sm">
            &copy; 2026 Auditure. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/terms" className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 hover:text-white text-sm transition-colors">
              Terms of Service
            </Link>
            <Link to="/" className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 hover:text-white text-sm transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[#2f2f2f] text-2xl mb-4">{title}</h2>
      <div className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] leading-relaxed">
        {children}
      </div>
    </div>
  );
}
