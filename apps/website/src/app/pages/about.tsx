import { Navigation } from "../components/navigation";
import { About } from "../components/about";
import { Footer } from "../components/footer";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-[#1A1512]">
      <Navigation />
      <main className="pt-20">
        <About />
      </main>
      <Footer />
    </div>
  );
}
