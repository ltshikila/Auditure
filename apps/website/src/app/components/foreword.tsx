import { Reveal } from "./reveal";
/*
 * The foreword. Deliberately shaped unlike every other section: no numeral, no
 * grid, no columns of short blocks. One narrow measure of running prose that
 * you actually sit and read. The page needs one place with real density or the
 * sparseness everywhere else reads as thin rather than deliberate.
 */
export function Foreword() {
  return (
    <section className="py-20 md:py-32 bg-[#1A1512]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="border-t border-[#EDE4D6]/25 pt-3 mb-14 md:mb-20 flex justify-end">
          <span className="label-caps text-[#EDE4D6]/50">Foreword</span>
        </Reveal>

        <Reveal delay={80} className="max-w-[34em] mx-auto font-['EB_Garamond',serif] text-[#EDE4D6] text-lg md:text-xl leading-[1.7]">
          <p className="dropcap prose-justified">
            Every book you have ever loved was, at some point, put in front of
            you by a particular person. Not by a summary, and not by an
            algorithm. By someone with opinions, and a way of talking, and a
            reason for pressing it into your hands.
          </p>

          <p className="mt-6 prose-justified">
            That person shapes the book. A friend who is suspicious of
            everything hands you a different <em>Sapiens</em> than a friend who
            is delighted by everything. Same pages. Different book.
          </p>

          <p className="mt-6 prose-justified">
            Auditure works the same way round. You design the host first. A
            name, a voice, an accent, a disposition. Then you give them
            something to read, and what comes back is that host, on that book,
            at length, in their own voice.
          </p>

          <p className="mt-6 prose-justified">
            Hand the same chapters to a skeptic and to an enthusiast and you get
            two episodes that disagree with each other. Both are worth the
            listen. That is the whole idea.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
