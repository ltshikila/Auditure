import { useEffect, useState } from 'react';
import { CHAPTERS } from './chapters';

/*
 * Two book objects, both scroll-driven.
 *
 * The running head: real books reprint the chapter name at the top of every
 * page. The nav deliberately scrolls away, so this is also the only orientation
 * you get on a very long page.
 *
 * The ribbon: a bookmark sewn into the binding, hanging further down the longer
 * you have read. Drawn flat with a notched tail rather than rendered as cloth,
 * so it stays a mark rather than a skeuomorph.
 */
export function ReadingMarker() {
  const [active, setActive] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;

      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);

      // The chapter you are "in" is the last one whose opening has passed the
      // upper third of the viewport.
      const line = window.innerHeight * 0.35;
      let current: number | null = null;
      CHAPTERS.forEach((chapter, i) => {
        const el = document.querySelector(chapter.href);
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      setActive(current);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const chapter = active === null ? null : CHAPTERS[active];

  return (
    <>
      {/* Ribbon bookmark */}
      <div
        aria-hidden="true"
        className="fixed top-0 right-6 md:right-10 z-30 w-[3px] pointer-events-none bg-[#C2A14D]/65"
        style={{
          height: `${progress * 100}vh`,
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 7px), 50% 100%, 0 calc(100% - 7px))',
        }}
      />

      {/* Running head */}
      <div
        className="hidden md:block fixed bottom-7 left-8 z-30 pointer-events-none transition-opacity duration-500"
        style={{ opacity: chapter ? 1 : 0 }}
      >
        {/* Cream, not brass. This is fixed, so it passes over the crimson band
            where brass drops to roughly 2.5:1 and stops being readable. */}
        <span className="label-caps text-[#EDE4D6]/55">
          {chapter ? `${chapter.numeral} · ${chapter.title}` : ''}
        </span>
      </div>
    </>
  );
}
