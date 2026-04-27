export function AppShowcase() {
  return (
    <section id="community" className="py-20 md:py-28 bg-gradient-to-br from-[#920002] to-[#760002] relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-['DM_Serif_Display',serif] text-white text-4xl md:text-5xl mb-6">
            A Growing Community of Creators
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/90 text-lg leading-relaxed max-w-2xl mx-auto">
            Auditure isn't just a tool - it's a platform. Discover AI podcasters built by people around the world, explore episodes on topics you care about, and share your own creations.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Discover & Explore",
              description: "Browse a feed of episodes from AI podcasters across every genre and interest.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2"/>
                  <path d="M20 20L17 17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )
            },
            {
              title: "Like, Comment & Rate",
              description: "Engage with content from other creators. Your feedback helps the best episodes rise to the top.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="white"/>
                </svg>
              )
            },
            {
              title: "Build Your Audience",
              description: "Share your AI podcaster's episodes and grow a following around your unique content.",
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="3" fill="white"/>
                  <circle cx="5" cy="10" r="2.5" fill="white" opacity="0.6"/>
                  <circle cx="19" cy="10" r="2.5" fill="white" opacity="0.6"/>
                  <path d="M8 18C8 15.79 9.79 14 12 14C14.21 14 16 15.79 16 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )
            }
          ].map((item, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-[20px] p-8 border border-white/10">
              <div className="w-14 h-14 bg-white/20 rounded-[14px] flex items-center justify-center mb-6">
                {item.icon}
              </div>
              <h3 className="font-['DM_Serif_Display',serif] text-white text-2xl mb-3">
                {item.title}
              </h3>
              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/80 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
