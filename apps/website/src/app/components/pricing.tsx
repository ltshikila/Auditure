import googlePlayIcon from '@/assets/google-play-icon.svg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.auditure.app';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try Auditure and create your first episodes.',
    features: [
      '3 episodes per month',
      'Up to 10 minutes per episode',
      'Standard AI voices',
      'Design your own podcaster',
      'Community feed access',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: '$9.99',
    period: 'per month',
    description: 'For regular listeners who want more from their books.',
    features: [
      '20 episodes per month',
      'Up to 30 minutes per episode',
      'Premium AI voices',
      'Unlimited podcasters',
      'All episode styles',
    ],
    cta: 'Start with Starter',
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '$24.99',
    period: 'per month',
    description: 'For serious creators making podcasts from their library.',
    features: [
      '50 episodes per month',
      'Up to 30 minutes per episode',
      'Premium AI voices',
      'Unlimited podcasters',
      'Priority generation',
    ],
    cta: 'Go Pro',
    highlighted: false,
  },
];

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M9 12L11 14L15 10" stroke="#920002" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" stroke="#920002" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-[#F5F0E8]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl md:text-5xl mb-4">
            Simple, Honest Pricing
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg md:text-xl max-w-2xl mx-auto">
            Start free. Upgrade when you're ready to create more.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative p-8 rounded-[24px] flex flex-col ${
                tier.highlighted
                  ? 'bg-[#920002] text-white shadow-xl md:scale-105'
                  : 'bg-[#FBF8F2] text-[#2f2f2f] border border-[#d0d0d0]/40'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FBF8F2] text-[#920002] px-4 py-1 rounded-full font-['Plus_Jakarta_Sans',sans-serif] text-sm">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-['DM_Serif_Display',serif] text-3xl mb-2">{tier.name}</h3>
                <p
                  className={`font-['Plus_Jakarta_Sans',sans-serif] text-sm ${
                    tier.highlighted ? 'text-white/80' : 'text-[#5a5a5a]'
                  }`}
                >
                  {tier.description}
                </p>
              </div>

              <div className="mb-8">
                <span className="font-['DM_Serif_Display',serif] text-5xl">{tier.price}</span>
                <span
                  className={`font-['Plus_Jakarta_Sans',sans-serif] text-base ml-2 ${
                    tier.highlighted ? 'text-white/80' : 'text-[#5a5a5a]'
                  }`}
                >
                  {tier.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 font-['Plus_Jakarta_Sans',sans-serif]"
                  >
                    {tier.highlighted ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path
                          d="M9 12L11 14L15 10"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.5" />
                      </svg>
                    ) : (
                      <CheckIcon />
                    )}
                    <span
                      className={`text-sm md:text-base ${
                        tier.highlighted ? 'text-white' : 'text-[#2f2f2f]'
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] font-['Plus_Jakarta_Sans',sans-serif] transition-colors ${
                  tier.highlighted
                    ? 'bg-white hover:bg-white/95 text-[#920002]'
                    : 'bg-[#920002] hover:bg-[#760002] text-white'
                }`}
              >
                <img src={googlePlayIcon} alt="" width="18" height="18" />
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-sm text-center mt-12">
          All paid plans billed monthly. Cancel anytime from inside the app.
        </p>
      </div>
    </section>
  );
}
