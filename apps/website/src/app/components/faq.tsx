import { useState } from "react";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What is an AI podcaster?",
    answer:
      "An AI podcaster is a custom virtual host you design inside Auditure. You give it a name, pick a voice and accent, define its personality and intellectual angle, then point it at a book. The podcaster generates a unique episode discussing the book in its own voice. No microphone, no editing, no studio.",
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
        stroke="#920002"
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
    <section id="faq" className="py-20 md:py-28 bg-[#FBF8F2]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl md:text-5xl mb-4">
            Frequently Asked Questions
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg max-w-xl mx-auto">
            Everything you might be wondering before you create your first podcaster.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <div
                key={item.question}
                className="bg-[#F5F0E8] rounded-[16px] border border-[#d0d0d0]/40 overflow-hidden"
              >
                <button
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-[#EFE9DF] transition-colors"
                  aria-expanded={open}
                >
                  <span className="font-['Plus_Jakarta_Sans',sans-serif] font-medium text-[#2f2f2f] text-base md:text-lg">
                    {item.question}
                  </span>
                  <ChevronIcon open={open} />
                </button>
                {open && (
                  <div className="px-6 pb-5">
                    <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-base leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-sm text-center mt-10">
          Still curious? Email us at{" "}
          <a href="mailto:support@auditure.app" className="text-[#920002] hover:underline">
            support@auditure.app
          </a>
        </p>
      </div>
    </section>
  );
}
