import { SectionOpener } from "./section-opener";
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

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-[#221A16]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionOpener
          numeral="VI"
          runningHead="Pricing"
          title="Simple, Honest Pricing"
          standfirst="Start free. Upgrade when you're ready to create more."
        />

        <div className="grid md:grid-cols-3 gap-x-12 lg:gap-x-16 gap-y-14">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col pt-4 border-t ${
                tier.highlighted ? 'border-t-2 border-[#C2A14D]' : 'border-[#EDE4D6]/25'
              }`}
            >
              <div className="flex items-baseline justify-between gap-4 mb-8">
                <span className="label-caps text-[#EDE4D6]/50">{tier.name}</span>
                {tier.highlighted && (
                  <span className="label-caps text-[#C2A14D]">Most Popular</span>
                )}
              </div>

              <div className="mb-4">
                <span className="font-['EB_Garamond',serif] text-[#EDE4D6] text-6xl">
                  {tier.price}
                </span>
                <span className="font-['EB_Garamond',serif] text-[#A2907C] text-lg ml-2">
                  {tier.period}
                </span>
              </div>

              <p className="font-['EB_Garamond',serif] text-[#A2907C] text-lg leading-relaxed mb-8">
                {tier.description}
              </p>

              <ul className="mb-10 flex-1">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="font-['EB_Garamond',serif] text-[#EDE4D6] text-lg py-2.5 border-t border-[#EDE4D6]/10"
                  >
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-[2px] btn-label transition-colors ${
                  tier.highlighted
                    ? 'gilt bg-[#C2A14D] hover:bg-[#D9B863] text-[#1A1512]'
                    : 'border border-[#EDE4D6]/25 text-[#EDE4D6] hover:border-[#C2A14D] hover:text-[#C2A14D]'
                }`}
              >
                <img src={googlePlayIcon} alt="" width="18" height="18" />
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="font-['EB_Garamond',serif] text-[#A2907C] text-sm text-center mt-12">
          All paid plans billed monthly. Cancel anytime from inside the app.
        </p>
      </div>
    </section>
  );
}
