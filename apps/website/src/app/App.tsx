import { Navigation } from "./components/navigation";
import { Hero } from "./components/hero";
import { Contents } from "./components/contents";
import { Epigraph } from "./components/epigraph";
import { Foreword } from "./components/foreword";
import { ReadingMarker } from "./components/reading-marker";
import { Features } from "./components/features";
import { WhyAuditure } from "./components/why-auditure";
import { AppShowcase } from "./components/app-showcase";
import { Screenshots } from "./components/screenshots";
import { EpisodeSnippets } from "./components/episode-snippets";
import { Pricing } from "./components/pricing";
import { FAQ } from "./components/faq";
import { CTA } from "./components/cta";
import { Footer } from "./components/footer";

export default function App() {
  return (
    // Full bleed. An earlier version inset the page on a darker ground so it read
    // as a bounded leaf, which worked when the page was cream on warm parchment.
    // Once the theme went dark that became near-black around near-black and just
    // looked like letterboxing, so the ground is gone.
    <div className="min-h-screen bg-[#1A1512]">
      <Navigation />
      <main>
        {/* Frontmatter: title page, epigraph, contents, foreword */}
        <Hero />
        <Epigraph />
        <Contents />
        <Foreword />

        {/* Chapters */}
        <WhyAuditure />
        <Features />
        <Screenshots />
        <AppShowcase />
        <EpisodeSnippets />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <ReadingMarker />

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
