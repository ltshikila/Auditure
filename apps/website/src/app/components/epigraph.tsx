import { Reveal } from "./reveal";
/*
 * An epigraph, the way a book opens on one. Set alone with a lot of air around
 * it and nothing else competing. Its job is to set the register before the
 * page starts selling anything.
 *
 * Bacon is public domain and the line maps directly onto episode styles: the
 * tasted book is a summary, the chewed and digested one is a deep dive.
 *
 * Dated 1597, the first edition of the Essayes, where this sentence already
 * appears. Not 1625, which is the expanded third edition retitled "Essayes or
 * Counsels, Civill and Morall".
 */
export function Epigraph() {
  return (
    <section className="bg-[#221A16] py-24 md:py-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-[30em] mx-auto">
        <blockquote>
          <p className="standfirst text-[#EDE4D6] text-2xl md:text-4xl leading-snug">
            Some books are to be tasted, others to be swallowed, and some few to
            be chewed and digested.
          </p>
          <footer className="label-caps text-[#EDE4D6]/45 mt-8">
            Francis Bacon, <span className="normal-case italic">Of Studies</span>, 1597
          </footer>
        </blockquote>
        </Reveal>
      </div>
    </section>
  );
}
