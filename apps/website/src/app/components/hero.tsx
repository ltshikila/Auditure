import googlePlayIcon from '@/assets/google-play-icon.svg';
import { WaitlistForm } from './waitlist-form';
import { COVERS } from './covers';
import { RANDOM_EPISODE_EVENT } from './episode-events';

/*
 * The wall goes behind the words.
 *
 * Borrowed from f(r)iction and Southwest Review, whose landing pages put
 * artwork underneath the type rather than in a tidy strip beside it. The books
 * are the product's raw material, so they should be the first thing you see and
 * the surface everything else sits on. Three covers deep, dimmed and vignetted
 * hard enough that Garamond stays legible on top.
 */
export function Hero() {
  const wall = [...COVERS, ...COVERS, ...COVERS];

  return (
    <section className="relative overflow-hidden min-h-[92vh] flex items-center">
      {/* The wall */}
      <div aria-hidden="true" className="absolute inset-0">
        {/*
         * Covers stay interactive so one can be pulled proud of the shelf on
         * hover, the way you tilt a spine out to read it. The overlays sit above
         * them and must not swallow the cursor.
         */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 h-full">
          {wall.map((cover, i) => (
            <img
              key={`${cover.title}-${i}`}
              src={cover.src}
              alt=""
              loading={i < 9 ? 'eager' : 'lazy'}
              className="w-full h-full object-cover origin-bottom transition-[transform,filter] duration-[600ms] ease-out hover:-translate-y-3 hover:scale-[1.04] hover:brightness-150"
            />
          ))}
        </div>

        {/* Lamplight. Dark enough for type, open enough to still read as books. */}
        <div className="absolute inset-0 pointer-events-none bg-[#0E0B09]/80" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0E0B09] via-[#0E0B09]/85 to-[#0E0B09]/40" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#1A1512] via-transparent to-[#1A1512]/70" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-24 md:py-32 w-full">
        <p className="label-caps text-[#C2A14D] mb-8">
          Any book. Any voice. Any angle.
        </p>

        <h1 className="font-['EB_Garamond',serif] text-[#EDE4D6] display-tight text-5xl md:text-7xl lg:text-8xl measure-wide">
          Create Your Own Virtual Podcaster
        </h1>

        <p className="standfirst text-[#EDE4D6]/70 text-xl md:text-2xl mt-8 measure">
          Design a Virtual Podcaster with its own voice and personality. Upload
          any book and it becomes a podcast.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-12">
          <a
            href="https://play.google.com/store/apps/details?id=com.auditure.app"
            target="_blank"
            rel="noopener noreferrer"
            className="gilt bg-[#C2A14D] hover:bg-[#D9B863] text-[#1A1512] px-8 py-4 rounded-[2px] btn-label flex items-center justify-center gap-3 transition-colors"
          >
            <img src={googlePlayIcon} alt="" width="24" height="24" />
            Download on Android
          </a>

          {/* Discovery, the way ONLY POEMS and Rattle both do it: one control
              that hands you something at random instead of making you choose. */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(RANDOM_EPISODE_EVENT))}
            className="border border-[#EDE4D6]/30 hover:border-[#C2A14D] hover:text-[#C2A14D] text-[#EDE4D6] px-8 py-4 rounded-[2px] btn-label flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            Open at Random
          </button>
        </div>

        <div className="flex flex-col items-start gap-3 mt-14 max-w-md">
          <p className="font-['EB_Garamond',serif] text-[#EDE4D6]/55 text-sm">
            On iOS? Get notified the moment we launch.
          </p>
          <WaitlistForm variant="dark" platform="ios" />
        </div>
      </div>
    </section>
  );
}
