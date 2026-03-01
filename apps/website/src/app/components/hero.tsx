import appLogo from 'figma:asset/9d4b5c5fc52fec774c788c231ec86fca8166a560.png';
import googlePlayIcon from '@/assets/google-play-icon.svg';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#FBF8F2] pt-20 pb-20 md:pt-32 md:pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-8">
          <div className="flex items-center gap-3">
            <img src={appLogo} alt="Auditure" className="w-16 h-16" />
            <h1 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl">Auditure</h1>
          </div>

          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-5xl md:text-6xl lg:text-7xl leading-tight">
            Create Your Own<br />
            AI Podcaster
          </h2>

          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg md:text-xl leading-relaxed max-w-2xl">
            Design an AI podcaster with its own voice and personality. Upload any book and turn it into engaging podcast episodes — lectures, debates, discussions, and more.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button className="bg-[#920002]/80 text-white px-8 py-4 rounded-[15px] shadow-md font-['Plus_Jakarta_Sans',sans-serif] flex items-center justify-center gap-3 cursor-default">
              <img src={googlePlayIcon} alt="" width="24" height="24" />
              Android Coming Soon
            </button>
            <button className="bg-white border-2 border-[#2f2f2f] text-[#2f2f2f] px-8 py-4 rounded-[15px] transition-all hover:bg-[#2f2f2f] hover:text-white font-['Plus_Jakarta_Sans',sans-serif] flex items-center justify-center gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
              </svg>
              iOS Coming Soon
            </button>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-[#920002] opacity-5 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[#2f2f2f] opacity-5 blur-[120px] rounded-full"></div>
    </section>
  );
}
