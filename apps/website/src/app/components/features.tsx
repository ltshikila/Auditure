import { Reveal } from "./reveal";
/*
 * Chapter II. Set as an index rather than a feature grid: tight rows, dot
 * leaders, small type, everything on one dense page. A book's index is the one
 * place it gets deliberately cramped, which is exactly the texture this page
 * was missing between all the air.
 */
const ENTRIES = [
  {
    term: 'Virtual Podcaster Creation',
    gloss: 'Name, voice, personality. It’s your show.',
  },
  {
    term: 'Book-to-Podcast',
    gloss: 'Any book you own, turned into audio episodes chapter by chapter.',
  },
  {
    term: 'Episode Styles',
    gloss: 'Lectures. Roundtable debates. Deep-dive discussions.',
  },
  {
    term: 'Community & Discovery',
    gloss: 'A feed of episodes from other creators. Like, comment, rate.',
  },
  {
    term: 'No Experience Needed',
    gloss: 'No microphone. No editing software. No radio voice.',
  },
  {
    term: 'Listen Anytime',
    gloss: 'Episodes generate in the background and wait for you.',
  },
  {
    term: 'Accents & Voices',
    gloss: 'A sarcastic British host sounds nothing like a calm American one.',
  },
  {
    term: 'Live Transcripts',
    gloss: 'Follow along, skip back, or just listen.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 bg-[#221A16]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Folio line, consistent across chapters */}
        <div className="border-t border-[#EDE4D6]/25 pt-3 flex items-baseline justify-between gap-4 mb-12 md:mb-16">
          <span className="label-caps text-[#EDE4D6]/50">II</span>
          <span className="label-caps text-[#EDE4D6]/50">Features</span>
        </div>

        <h2 className="font-['EB_Garamond',serif] text-[#EDE4D6] display-tight text-3xl md:text-4xl mb-10">
          An Index of What You Get
        </h2>

        <dl>
          {ENTRIES.map((entry, i) => (
            /* Small stagger. An index should feel like it is being set line by
               line, not like eight separate announcements. */
            <Reveal
              key={entry.term}
              delay={i * 45}
              className="flex flex-wrap items-baseline gap-x-3 py-2.5 border-t border-[#EDE4D6]/10"
            >
              <dt className="font-['EB_Garamond',serif] text-[#EDE4D6] text-lg shrink-0">
                {entry.term}
              </dt>
              <span
                aria-hidden="true"
                className="flex-1 min-w-8 border-b border-dotted border-[#EDE4D6]/20 translate-y-[-0.3em]"
              />
              <dd className="font-['EB_Garamond',serif] text-[#A2907C] text-base md:text-right md:max-w-[22em]">
                {entry.gloss}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
