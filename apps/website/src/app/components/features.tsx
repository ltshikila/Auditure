export function Features() {
  const features = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 18.75C11.59 18.75 11.25 18.41 11.25 18V14C11.25 13.59 11.59 13.25 12 13.25C12.41 13.25 12.75 13.59 12.75 14V18C12.75 18.41 12.41 18.75 12 18.75Z" fill="white"/>
          <path d="M12 14C10.35 14 9 12.65 9 11V6C9 4.35 10.35 3 12 3C13.65 3 15 4.35 15 6V11C15 12.65 13.65 14 12 14Z" fill="white"/>
          <path d="M12 22C7.59 22 4 18.41 4 14V12C4 11.59 4.34 11.25 4.75 11.25C5.16 11.25 5.5 11.59 5.5 12V14C5.5 17.58 8.42 20.5 12 20.5C15.58 20.5 18.5 17.58 18.5 14V12C18.5 11.59 18.84 11.25 19.25 11.25C19.66 11.25 20 11.59 20 12V14C20 18.41 16.41 22 12 22Z" fill="white" opacity="0.6"/>
        </svg>
      ),
      bg: "bg-[#920002]",
      title: "Virtual Podcaster Creation",
      description: "Design a virtual podcaster with a custom name, voice, and personality. It's your show - you decide how it sounds."
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 5.3V21.33C11.83 21.33 11.65 21.3 11.51 21.22L11.47 21.2C9.55 20.15 6.2 19.05 4.03 18.76L3.74 18.72C2.78 18.6 2 17.7 2 16.74V4.66C2 3.47 2.97 2.57 4.16 2.67C6.26 2.84 9.44 3.9 11.22 5.01L11.47 5.16C11.62 5.25 11.81 5.3 12 5.3Z" fill="white"/>
          <path d="M22 4.67V16.74C22 17.7 21.22 18.6 20.26 18.72L19.93 18.76C17.75 19.05 14.39 20.16 12.47 21.22C12.34 21.3 12.18 21.33 12 21.33V5.3C12.19 5.3 12.38 5.25 12.53 5.16L12.7 5.05C14.48 3.93 17.67 2.86 19.77 2.68H19.83C21.02 2.58 22 3.47 22 4.67Z" fill="white" opacity="0.6"/>
        </svg>
      ),
      bg: "bg-[#2f2f2f]",
      title: "Book-to-Podcast",
      description: "Upload any book you own and your Virtual Podcaster transforms it into audio episodes. Read more books without reading."
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect x="6.5" y="10" width="3" height="7" rx="1.5" fill="white" opacity="0.6"/>
          <rect x="10.5" y="7" width="3" height="10" rx="1.5" fill="white"/>
          <rect x="14.5" y="4" width="3" height="13" rx="1.5" fill="white" opacity="0.6"/>
        </svg>
      ),
      bg: "bg-[#920002]",
      title: "Multiple Episode Styles",
      description: "Choose how your book is presented - lectures, roundtable debates, deep-dive discussions. Every style brings a fresh perspective."
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3" fill="white"/>
          <circle cx="5" cy="10" r="2.5" fill="white" opacity="0.6"/>
          <circle cx="19" cy="10" r="2.5" fill="white" opacity="0.6"/>
          <path d="M8 18C8 15.79 9.79 14 12 14C14.21 14 16 15.79 16 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <path d="M2 20C2 18.34 3.34 17 5 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          <path d="M22 20C22 18.34 20.66 17 19 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
        </svg>
      ),
      bg: "bg-[#2f2f2f]",
      title: "Community & Discovery",
      description: "Browse a feed of AI-generated episodes from other creators. Like, comment, rate, and discover content you'd never find elsewhere."
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.6"/>
        </svg>
      ),
      bg: "bg-[#920002]",
      title: "No Experience Needed",
      description: "You don't need a microphone, editing software, or a radio voice. Just upload a book and let your Virtual Podcaster do the rest."
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.6"/>
          <path d="M12 7V12L15 14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      bg: "bg-[#2f2f2f]",
      title: "Listen Anytime",
      description: "Episodes are generated and ready to play. Listen on your commute, at the gym, while cooking - wherever life takes you."
    }
  ];

  return (
    <section id="features" className="py-20 md:py-28 bg-[#F5F0E8]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl md:text-5xl mb-4">
            Everything You Need to Create
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg md:text-xl max-w-2xl mx-auto">
            A complete platform for creating, listening, and sharing AI-powered podcast episodes
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-[20px] bg-[#FBF8F2] hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-[#920002]/10"
            >
              <div className={`w-14 h-14 ${feature.bg} rounded-[14px] flex items-center justify-center mb-6`}>
                {feature.icon}
              </div>
              <h3 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-2xl mb-3">
                {feature.title}
              </h3>
              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
