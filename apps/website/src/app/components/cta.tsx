import googlePlayIcon from '@/assets/google-play-icon.svg';

export function CTA() {
  return (
    <section className="py-20 md:py-28 bg-[#2f2f2f] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#920002] opacity-10 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#920002] opacity-10 blur-[100px] rounded-full"></div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="font-['DM_Serif_Display',serif] text-white text-4xl md:text-5xl lg:text-6xl mb-6">
          Ready to Create Your<br />First AI Podcaster?
        </h2>
        <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/80 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
          Turn your bookshelf into a podcast library. Create an AI podcaster, upload a book, and start listening in minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <button className="bg-[#920002] hover:bg-[#760002] text-white px-10 py-5 rounded-[15px] transition-colors shadow-lg font-['Plus_Jakarta_Sans',sans-serif] text-lg flex items-center justify-center gap-3">
            <img src={googlePlayIcon} alt="" width="28" height="28" />
            Get it on Google Play
          </button>
          <button className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 px-10 py-5 rounded-[15px] transition-colors font-['Plus_Jakarta_Sans',sans-serif] text-lg flex items-center justify-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
            </svg>
            iOS Coming Soon
          </button>
        </div>

        {/* Key stats */}
        <div className="grid gap-6 md:grid-cols-3 mt-16">
          <div className="bg-white/5 backdrop-blur-sm rounded-[20px] p-6 border border-white/10">
            <div className="w-12 h-12 bg-[#920002] rounded-[12px] flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 18.75C11.59 18.75 11.25 18.41 11.25 18V14C11.25 13.59 11.59 13.25 12 13.25C12.41 13.25 12.75 13.59 12.75 14V18C12.75 18.41 12.41 18.75 12 18.75Z" fill="white"/>
                <path d="M12 14C10.35 14 9 12.65 9 11V6C9 4.35 10.35 3 12 3C13.65 3 15 4.35 15 6V11C15 12.65 13.65 14 12 14Z" fill="white"/>
                <path d="M12 22C7.59 22 4 18.41 4 14V12C4 11.59 4.34 11.25 4.75 11.25C5.16 11.25 5.5 11.59 5.5 12V14C5.5 17.58 8.42 20.5 12 20.5C15.58 20.5 18.5 17.58 18.5 14V12C18.5 11.59 18.84 11.25 19.25 11.25C19.66 11.25 20 11.59 20 12V14C20 18.41 16.41 22 12 22Z" fill="white" opacity="0.6"/>
              </svg>
            </div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-white mb-2">
              Custom AI Voices
            </h4>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 text-sm">
              Every podcaster sounds unique
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-[20px] p-6 border border-white/10">
            <div className="w-12 h-12 bg-[#920002] rounded-[12px] flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 5.3V21.33C11.83 21.33 11.65 21.3 11.51 21.22L11.47 21.2C9.55 20.15 6.2 19.05 4.03 18.76L3.74 18.72C2.78 18.6 2 17.7 2 16.74V4.66C2 3.47 2.97 2.57 4.16 2.67C6.26 2.84 9.44 3.9 11.22 5.01L11.47 5.16C11.62 5.25 11.81 5.3 12 5.3Z" fill="white"/>
                <path d="M22 4.67V16.74C22 17.7 21.22 18.6 20.26 18.72L19.93 18.76C17.75 19.05 14.39 20.16 12.47 21.22C12.34 21.3 12.18 21.33 12 21.33V5.3C12.19 5.3 12.38 5.25 12.53 5.16L12.7 5.05C14.48 3.93 17.67 2.86 19.77 2.68H19.83C21.02 2.58 22 3.47 22 4.67Z" fill="white" opacity="0.6"/>
              </svg>
            </div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-white mb-2">
              Any Book You Own
            </h4>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 text-sm">
              Upload and transform instantly
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-[20px] p-6 border border-white/10">
            <div className="w-12 h-12 bg-[#920002] rounded-[12px] flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="3" fill="white"/>
                <circle cx="5" cy="10" r="2.5" fill="white" opacity="0.6"/>
                <circle cx="19" cy="10" r="2.5" fill="white" opacity="0.6"/>
                <path d="M8 18C8 15.79 9.79 14 12 14C14.21 14 16 15.79 16 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-white mb-2">
              Share & Discover
            </h4>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 text-sm">
              A community of AI podcast creators
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-16 pt-12 border-t border-white/10">
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 text-sm">
            Available now on Android &middot; iOS launching Q2 2026
          </p>
        </div>
      </div>
    </section>
  );
}
