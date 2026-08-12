import { CHAPTERS as ENTRIES } from './chapters';

export function Contents() {
  return (
    <section className="py-20 md:py-28 bg-[#1A1512]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="border-t border-[#EDE4D6]/25 pt-3 mb-12 md:mb-16 flex justify-end">
          <span className="label-caps text-[#EDE4D6]/50">Contents</span>
        </div>

        <ul>
          {ENTRIES.map((entry, index) => (
            <li key={entry.href}>
              <a
                href={entry.href}
                className="group flex items-baseline gap-4 py-3.5 text-[#EDE4D6] hover:text-[#C2A14D] transition-colors"
              >
                <span className="label-caps text-[#EDE4D6]/40 w-10 shrink-0 group-hover:text-[#C2A14D]/60 transition-colors">
                  {entry.numeral}
                </span>
                <span className="font-['EB_Garamond',serif] text-xl md:text-2xl shrink-0">
                  {entry.title}
                </span>
                {/* Dot leader, the way a contents page runs one */}
                <span
                  aria-hidden="true"
                  className="flex-1 border-b border-dotted border-[#EDE4D6]/25 translate-y-[-0.3em]"
                />
                <span className="font-['EB_Garamond',serif] text-lg text-[#EDE4D6]/60 shrink-0 tabular-nums">
                  {index + 1}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
