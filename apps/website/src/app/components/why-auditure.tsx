import googlePlayIcon from '@/assets/google-play-icon.svg';

export function WhyAuditure() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-[#FBF8F2]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl md:text-5xl mb-4">
            How It Works
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg md:text-xl max-w-2xl mx-auto">
            From book to podcast in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="grid gap-12 md:grid-cols-3 mb-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-[#920002] rounded-[20px] flex items-center justify-center mx-auto mb-6">
              <span className="font-['DM_Serif_Display',serif] text-white text-3xl">1</span>
            </div>
            <h3 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-2xl mb-3">
              Create a Podcaster
            </h3>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] leading-relaxed">
              Design your own AI podcaster. Give it a name, a voice, and a unique personality. No mic or studio required.
            </p>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 bg-[#2f2f2f] rounded-[20px] flex items-center justify-center mx-auto mb-6">
              <span className="font-['DM_Serif_Display',serif] text-white text-3xl">2</span>
            </div>
            <h3 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-2xl mb-3">
              Upload a Book
            </h3>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] leading-relaxed">
              Upload any book you own. Your AI podcaster transforms it into engaging audio episodes — lectures, debates, discussions, and more.
            </p>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 bg-[#920002] rounded-[20px] flex items-center justify-center mx-auto mb-6">
              <span className="font-['DM_Serif_Display',serif] text-white text-3xl">3</span>
            </div>
            <h3 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-2xl mb-3">
              Listen & Share
            </h3>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] leading-relaxed">
              Listen to your episodes on the go. Share them with the community, discover what others are creating, and join the conversation.
            </p>
          </div>
        </div>

        {/* Value Prop Banner */}
        <div className="bg-gradient-to-br from-[#920002] to-[#760002] rounded-[30px] p-8 md:p-12 text-center text-white">
          <h3 className="font-['DM_Serif_Display',serif] text-3xl md:text-4xl mb-4">
            Your Books Deserve to Be Heard
          </h3>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/90 text-lg mb-8 max-w-2xl mx-auto">
            That bookshelf of unread books? Turn them into podcast episodes you can listen to while commuting, working out, or relaxing. No more excuses — just press play.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white/90 text-[#920002] px-8 py-4 rounded-[15px] shadow-lg font-['Plus_Jakarta_Sans',sans-serif] flex items-center justify-center gap-3 cursor-default">
              <img src={googlePlayIcon} alt="" width="24" height="24" />
              Android Coming Soon
            </button>
          </div>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/70 text-sm mt-6">
            Android &amp; iOS launching soon
          </p>
        </div>
      </div>
    </section>
  );
}
