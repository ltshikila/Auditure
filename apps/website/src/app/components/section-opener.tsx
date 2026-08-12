import { Reveal } from "./reveal";
type SectionOpenerProps = {
  /** Folio numeral. Runs I–VII down the page so the sections read as a sequence. */
  numeral: string;
  /** Running head, set at the right of the rule the way a book sets one. */
  runningHead: string;
  title: string;
  standfirst?: string;
  tone?: "dark" | "light";
};

export function SectionOpener({
  numeral,
  runningHead,
  title,
  standfirst,
  tone = "dark",
}: SectionOpenerProps) {
  const rule = tone === "dark" ? "border-[#EDE4D6]/25" : "border-white/30";
  const meta = tone === "dark" ? "text-[#EDE4D6]/50" : "text-white/55";
  const ink = tone === "dark" ? "text-[#EDE4D6]" : "text-white";
  const sub = tone === "dark" ? "text-[#A2907C]" : "text-white/70";

  return (
    <Reveal className="mb-14 md:mb-20">
      <div className={`border-t ${rule} pt-3 flex items-baseline justify-between gap-4`}>
        <span className={`label-caps ${meta}`}>{numeral}</span>
        <span className={`label-caps ${meta}`}>{runningHead}</span>
      </div>

      <h2
        className={`font-['EB_Garamond',serif] ${ink} display-tight text-4xl md:text-6xl mt-10 md:mt-14 measure-wide`}
      >
        {title}
      </h2>

      {standfirst && (
        <p className={`standfirst ${sub} text-xl md:text-2xl mt-5 measure`}>
          {standfirst}
        </p>
      )}
    </Reveal>
  );
}
