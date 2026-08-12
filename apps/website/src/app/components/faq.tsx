import { SectionOpener } from "./section-opener";
import { useState } from "react";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What is a Virtual Podcaster?",
    answer:
      "A Virtual Podcaster is a custom host you design inside Auditure. You give it a name, pick a voice and accent, define its personality and intellectual angle, then point it at a book. The podcaster generates a unique episode discussing the book in its own voice. No microphone, no editing, no studio.",
  },
  {
    question: "How does it work?",
    answer:
      "Upload a book you own (PDF or EPUB), pick or design a podcaster, choose an episode style like a lecture or debate, and Auditure generates a full episode script and turns it into audio. Each episode is unique to the podcaster you used. Listen, share, or generate a different angle on the same chapters.",
  },
  {
    question: "What kind of books can I upload?",
    answer:
      "Most non-fiction and fiction books work, including PDFs and EPUBs you legally own. Auditure extracts the text, identifies the chapters, and generates audio from the source. Books with heavy formatting (textbooks, illustrated guides) may take longer to extract.",
  },
  {
    question: "Are the AI voices realistic?",
    answer:
      "Yes. Paid plans use Google's Gemini Pro voice models, which are among the most natural sounding voices available. You can also pick accents and tone, so a sarcastic British host sounds different from a calm American academic. Free plan uses a hybrid of standard voices.",
  },
  {
    question: "Is my book data private?",
    answer:
      "Yes. Your uploaded books are private by default and only used to generate your own episodes. We do not share book content with third parties, and we do not train models on the books you upload.",
  },
  {
    question: "How much does it cost?",
    answer:
      "There is a free plan with 3 episodes per month. Starter is $9.99 per month for 20 episodes with premium voices, and Pro is $24.99 per month for 50 episodes with priority generation. All paid plans bill monthly and cancel anytime from inside the app.",
  },
  {
    question: "Can I share the episodes I create?",
    answer:
      "Yes. You can publish episodes to the community feed where other listeners discover, like, and rate them. You can also keep them private for personal listening. Either way, the episodes you generate are yours.",
  },
  {
    question: "Does Auditure work on iOS?",
    answer:
      "Not yet. Auditure is currently live on Google Play for Android. iOS is in development and you can join the waitlist on the homepage to be notified the moment it launches.",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="#C2A14D"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-28 bg-[#1A1512]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <SectionOpener
            numeral="VII"
            runningHead="Questions"
            title="Frequently Asked Questions"
            standfirst="The things people ask before making their first podcaster."
          />
        </div>

        <div className="border-b border-[#EDE4D6]/15">
          {FAQ_ITEMS.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <div key={item.question} className="border-t border-[#EDE4D6]/15">
                <button
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="w-full flex items-baseline justify-between gap-6 py-6 text-left group"
                  aria-expanded={open}
                >
                  <span className="flex items-baseline gap-5">
                    <span className="label-caps text-[#EDE4D6]/35 shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="font-['EB_Garamond',serif] text-[#EDE4D6] text-xl md:text-2xl group-hover:text-[#C2A14D] transition-colors">
                      {item.question}
                    </span>
                  </span>
                  <ChevronIcon open={open} />
                </button>
                {open && (
                  <div className="pb-8 pl-0 md:pl-[3.75rem]">
                    <p className="font-['EB_Garamond',serif] text-[#A2907C] text-lg leading-relaxed measure prose-justified">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="font-['EB_Garamond',serif] text-[#A2907C] text-sm text-center mt-10">
          Still curious? Email us at{" "}
          <a href="mailto:support@auditure.app" className="text-[#C2A14D] hover:underline">
            support@auditure.app
          </a>
        </p>
      </div>
    </section>
  );
}
