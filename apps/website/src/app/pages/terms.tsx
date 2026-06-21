import { Link } from "react-router";
import appLogo from 'figma:asset/9d4b5c5fc52fec774c788c231ec86fca8166a560.png';

export function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-sm mb-10">
          Last updated: February 2026
        </p>

        <Section title="1. Acceptance of Terms">
          <p>By creating an account or using Auditure, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>Auditure is an AI-powered platform where users create Virtual Podcasters and convert books and written content into podcast-style audio episodes. The service includes Virtual Podcaster creation and customisation, audio episode generation, social features (feed, comments, likes, ratings), and related features available through our mobile application.</p>
        </Section>

        <Section title="3. User Accounts">
          <p>You must be at least 13 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration.</p>
        </Section>

        <Section title="4. Subscriptions & Payments">
          <p>Auditure offers free and paid subscription tiers. Paid subscriptions are billed monthly through Paystack. Subscriptions automatically renew unless cancelled before the end of the current billing period. Cancellation takes effect at the end of your current billing cycle - you retain access until then.</p>
        </Section>

        <Section title="5. User-Uploaded Content & Copyright">
          <p className="mb-3">You are solely responsible for all content you upload to Auditure, including books, text, and other materials. By uploading content, you represent and warrant that:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>You own or have the legal right to use the content you upload</li>
            <li>Your use of the content does not infringe on the copyright, intellectual property, or other rights of any third party</li>
            <li>You have obtained all necessary permissions, licences, or authorisations required to upload and process the content</li>
          </ul>
          <p>Auditure does not verify the ownership or legality of user-uploaded content. You assume full responsibility and liability for any content you upload and any consequences arising from its use. Auditure is not liable for any copyright infringement or legal claims resulting from user-uploaded content.</p>
        </Section>

        <Section title="6. Copyright Infringement & DMCA">
          <p className="mb-3">Auditure respects the intellectual property rights of others. If you believe that content on Auditure infringes your copyright, you may submit a takedown notice to <a href="mailto:support@auditure.com" className="text-[#920002] hover:underline">support@auditure.com</a> containing:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>A description of the copyrighted work you believe has been infringed</li>
            <li>A description of the material you believe is infringing and its location on the platform</li>
            <li>Your contact information (name, address, email, phone number)</li>
            <li>A statement that you have a good faith belief that the use is not authorised by the copyright owner</li>
            <li>A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorised to act on their behalf</li>
            <li>Your physical or electronic signature</li>
          </ul>
          <p>We will review and respond to valid takedown requests in a timely manner. Users who repeatedly infringe copyright may have their accounts suspended or terminated.</p>
        </Section>

        <Section title="7. AI-Generated Content">
          <p className="mb-3">Auditure uses AI to generate audio episodes based on user-uploaded content. AI-generated episodes are transformative works that may include lectures, discussions, summaries, and commentary derived from the source material - they are not verbatim reproductions.</p>
          <p>AI-generated audio may contain inaccuracies, interpretive differences, or imperfections. Auditure does not guarantee the accuracy or completeness of AI-generated content. Generated episodes are provided for your personal, non-commercial use. You may not redistribute, resell, or publicly broadcast generated content without prior written consent.</p>
        </Section>

        <Section title="8. Virtual Podcasters">
          <p className="mb-3">Users may create and customise Virtual Podcaster personalities on Auditure. By creating a Virtual Podcaster, you agree that:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>You will not create Virtual Podcasters that impersonate real individuals without their consent</li>
            <li>You will not use Virtual Podcasters to generate harmful, misleading, defamatory, or illegal content</li>
            <li>Auditure may remove Virtual Podcasters or generated content that violates these terms or applicable law</li>
          </ul>
          <p>Virtual Podcasters you create may be visible to other users on the platform through the social feed and discovery features.</p>
        </Section>

        <Section title="9. Community & Social Features">
          <p className="mb-3">Auditure includes social features such as a feed, comments, likes, and ratings. By using these features, you agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>Treat other users with respect</li>
            <li>Not post spam, harassment, hate speech, or abusive content</li>
            <li>Not use the platform to promote illegal activities</li>
            <li>Not attempt to manipulate ratings, likes, or other engagement metrics</li>
          </ul>
          <p>Auditure reserves the right to remove any user-generated content (comments, ratings, etc.) that violates these terms, and to suspend or terminate accounts engaged in abusive behaviour.</p>
        </Section>

        <Section title="10. Acceptable Use">
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Upload content that you do not have the legal right to use</li>
            <li>Use the service for illegal or harmful purposes</li>
            <li>Attempt to reverse-engineer, hack, or disrupt the service</li>
            <li>Create multiple accounts to circumvent usage limits</li>
            <li>Share your account credentials with others</li>
            <li>Use automated tools or bots to access the service</li>
            <li>Scrape, collect, or harvest content or user data from the platform</li>
          </ul>
        </Section>

        <Section title="11. Usage Limits">
          <p>Each subscription tier includes monthly episode generation limits. Usage resets at the start of each billing cycle. Auditure reserves the right to modify usage limits with reasonable notice.</p>
        </Section>

        <Section title="12. Termination">
          <p>We may suspend or terminate your account if you violate these terms, including but not limited to repeated copyright infringement, abusive behaviour, or fraudulent activity. You may delete your account at any time through the app settings. Upon account deletion, your data will be permanently removed in accordance with our Privacy Policy.</p>
        </Section>

        <Section title="13. Disclaimers">
          <p>Auditure is provided "as is" without warranties of any kind. AI-generated audio may contain inaccuracies or imperfections. We do not guarantee uninterrupted or error-free service. Auditure is not responsible for the accuracy, legality, or quality of user-uploaded content or AI-generated output.</p>
        </Section>

        <Section title="14. Limitation of Liability">
          <p>To the maximum extent permitted by law, Auditure shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including but not limited to damages arising from user-uploaded content, AI-generated output, or interactions with other users on the platform.</p>
        </Section>

        <Section title="15. Changes to Terms">
          <p>We may update these terms from time to time. We will notify you of significant changes through the app or via email. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
        </Section>

        <Section title="16. Contact">
          <p>If you have questions about these Terms of Service, please contact us at <a href="mailto:support@auditure.com" className="text-[#920002] hover:underline">support@auditure.com</a>.</p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="bg-[#191815] py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/40 text-sm">
            &copy; 2026 Auditure. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/privacy" className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 hover:text-white text-sm transition-colors">
              Privacy Policy
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
