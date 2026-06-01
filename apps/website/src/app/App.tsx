import { Navigation } from "./components/navigation";
import { Hero } from "./components/hero";
import { Features } from "./components/features";
import { WhyAuditure } from "./components/why-auditure";
import { AppShowcase } from "./components/app-showcase";
import { Pricing } from "./components/pricing";
import { About } from "./components/about";
import { CTA } from "./components/cta";
import { Footer } from "./components/footer";

export default function App() {
  return (
    <div className="min-h-screen bg-[#FBF8F2]">
      <Navigation />
      <main>
        <Hero />
        <WhyAuditure />
        <Features />
        <AppShowcase />
        <Pricing />
        <About />
        <CTA />
      </main>
      <Footer />

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
