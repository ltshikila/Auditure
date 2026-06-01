import founderPortrait from '@/assets/founder_portrait.jpeg';

export function About() {
  return (
    <section id="about" className="py-20 md:py-28 bg-[#FBF8F2]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl md:text-5xl mb-4">
            About Auditure Studios
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg md:text-xl max-w-2xl mx-auto">
            A creator platform for AI-powered audio.
          </p>
        </div>

        {/* Company Description */}
        <div className="max-w-3xl mx-auto mb-20">
          <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif] text-[#2f2f2f] text-base md:text-lg leading-relaxed">
            <p>
              Auditure Studios is building a new kind of audio creator platform. We believe books deserve
              to be heard, and that every reader should be able to design the podcast they wish existed
              for the books on their shelf.
            </p>
            <p>
              With Auditure, anyone can create their own AI podcaster, give it a voice and a personality,
              then turn any book they own into engaging audio episodes: lectures, debates, deep dives,
              casual discussions, and more. No microphone, no editing software, no radio voice required.
            </p>
            <p>
              Based in Pretoria, South Africa with a global audience, Auditure Studios launched on
              Google Play in April 2026. iOS is in development.
            </p>
          </div>
        </div>

        {/* Founder */}
        <div className="max-w-2xl mx-auto">
          <h3 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-3xl mb-8 text-center">
            The Team
          </h3>

          <div className="bg-[#F5F0E8] rounded-[24px] p-8 md:p-10 border border-[#d0d0d0]/40">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Portrait */}
              <img
                src={founderPortrait}
                alt="Lubabalo Tshikila, Founder of Auditure Studios"
                className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover shrink-0 shadow-lg"
              />

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <h4 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-2xl mb-1">
                  Lubabalo Tshikila
                </h4>
                <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#920002] text-sm mb-4 tracking-wide uppercase">
                  Founder
                </p>
                <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-base leading-relaxed mb-5">
                  A recent college graduate now pursuing graduate studies, Lubabalo started building
                  Auditure after a passing thought. What if anyone could turn the books they owned
                  into podcasts hosted by AI personalities? That idea turned into something he had to ship.
                  What began as "just a cool idea" became a creator platform live on Google Play in
                  under a year.
                </p>
                <a
                  href="https://www.linkedin.com/in/lubabalo-tshikila-508952384"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-['Plus_Jakarta_Sans',sans-serif] text-[#920002] hover:text-[#760002] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  Connect on LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
