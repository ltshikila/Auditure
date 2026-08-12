import { Reveal } from "./reveal";
import googlePlayIcon from '@/assets/google-play-icon.svg';

/*
 * Chapter I. Shaped as a manuscript sequence, not a three-up grid: each step is
 * a full-width row with an oversized numeral standing in the margin, the way an
 * illuminated initial sits beside its paragraph. Nothing here is a column.
 */
const STEPS = [
  {
    numeral: 'I',
    title: 'Create a Podcaster',
    body: 'Give it a name, a voice, and a personality of its own. No mic, no studio.',
  },
  {
    numeral: 'II',
    title: 'Upload a Book',
    body: 'Any book you own. Your Virtual Podcaster turns it into episodes: lectures, debates, discussions.',
  },
  {
    numeral: 'III',
    title: 'Listen & Share',
    body: 'Take them with you. Share what you make, and hear what everyone else is building.',
  },
];

export function WhyAuditure() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-[#1A1512]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Folio line, consistent across chapters */}
        <div className="border-t border-[#EDE4D6]/25 pt-3 flex items-baseline justify-between gap-4 mb-16 md:mb-24">
          <span className="label-caps text-[#EDE4D6]/50">I</span>
          <span className="label-caps text-[#EDE4D6]/50">How It Works</span>
        </div>

        <div>
          {STEPS.map((step, i) => (
            <Reveal
              key={step.numeral}
              delay={i * 90}
              className={`flex flex-col md:flex-row md:items-start gap-4 md:gap-12 py-10 md:py-14 ${
                i > 0 ? 'border-t border-[#EDE4D6]/12' : ''
              }`}
            >
              {/*
               * Flush right in the margin column, so the gap to each title is
               * constant. Left-aligned the numerals ragged out, since "I" is
               * thin and "III" is wide.
               *
               * Cap-tops are aligned rather than baselines. On a shared baseline
               * a 96px numeral rears about 31px over a 48px title and the two
               * stop looking like one line. The -0.06em lifts the numeral's cap
               * onto the title's: both are Garamond and the numeral is always
               * exactly twice the title's size at every breakpoint, so the
               * correction holds in em without needing a per-breakpoint value.
               */}
              <span
                aria-hidden="true"
                className="font-['EB_Garamond',serif] text-[#C2A14D]/70 text-6xl md:text-8xl leading-none shrink-0 md:w-32 md:text-right md:-mt-[0.06em]"
              >
                {step.numeral}
              </span>

              <div className="md:flex-1">
                <h3 className="font-['EB_Garamond',serif] text-[#EDE4D6] display-tight text-3xl md:text-5xl">
                  {step.title}
                </h3>
                <p className="font-['EB_Garamond',serif] text-[#A2907C] text-lg md:text-xl leading-relaxed mt-4 measure">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Value Prop Banner */}
        <Reveal className="bg-[#920002] rounded-[2px] p-8 md:p-14 text-white mt-16 md:mt-24">
          <h3 className="font-['EB_Garamond',serif] text-3xl md:text-5xl mb-4 max-w-xl leading-tight">
            Your Books Deserve to Be Heard
          </h3>
          <p className="font-['EB_Garamond',serif] text-white/85 text-lg mb-8 max-w-xl leading-relaxed">
            That shelf of books you meant to get to? Turn them into episodes you can listen to on the way to work. Press play.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="https://play.google.com/store/apps/details?id=com.auditure.app"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#EDE4D6] hover:bg-white text-[#920002] px-8 py-4 rounded-[2px] btn-label flex items-center justify-center gap-3 transition-colors"
            >
              <img src={googlePlayIcon} alt="" width="24" height="24" />
              Download on Android
            </a>
          </div>
          <p className="font-['EB_Garamond',serif] text-white/70 text-sm mt-6">
            Live on Android. iOS coming soon.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
