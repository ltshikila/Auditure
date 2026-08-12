import { SectionOpener } from './section-opener';

export function AppShowcase() {
  const items = [
    {
      title: "Discover & Explore",
      description: "A feed of episodes from Virtual Podcasters across every genre and interest."
    },
    {
      title: "Like, Comment & Rate",
      description: "Engage with other creators. Your feedback pushes the best episodes to the top."
    },
    {
      title: "Build Your Audience",
      description: "Share your Virtual Podcaster's episodes and grow a following around them."
    }
  ];

  return (
    <section id="community" className="py-20 md:py-28 bg-[#920002]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionOpener
          numeral="IV"
          runningHead="Community"
          title="Other People’s Hosts"
          standfirst="Everything anyone makes lands in the same feed."
          tone="light"
        />

        <p className="font-['EB_Garamond',serif] text-white/80 text-lg leading-relaxed measure prose-justified mb-14 md:mb-20 -mt-6 md:-mt-10">
          Find Virtual Podcasters built by people around the world, explore episodes on subjects you actually care about, and put your own out there.
        </p>

        {/* Community */}
        <div className="grid gap-10 md:gap-12 md:grid-cols-3">
          {items.map((item, index) => (
            <div key={index} className="border-t border-white/25 pt-6">
              <h3 className="font-['EB_Garamond',serif] text-white text-2xl mb-3">
                {item.title}
              </h3>
              <p className="font-['EB_Garamond',serif] text-white/80 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
