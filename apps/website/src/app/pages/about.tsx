import { Navigation } from "../components/navigation";
import { About } from "../components/about";
import { Footer } from "../components/footer";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FBF8F2]">
      <Navigation />
      <main className="pt-20">
        <About />
      </main>
      <Footer />
    </div>
  );
}
