import appLogo from 'figma:asset/9d4b5c5fc52fec774c788c231ec86fca8166a560.png';
import googlePlayIcon from '@/assets/google-play-icon.svg';

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FBF8F2]/80 backdrop-blur-lg border-b border-[#d0d0d0]/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={appLogo} alt="Auditure" className="w-10 h-10" />
            <span className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-2xl">Auditure</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Features', href: '#features' },
              { label: 'Community', href: '#community' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="font-['Plus_Jakarta_Sans',sans-serif] text-[#2f2f2f] hover:text-[#920002] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex items-center gap-4">
            <a
              href="https://play.google.com/store/apps/details?id=com.auditure.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 bg-[#920002] hover:bg-[#760002] text-white px-6 py-3 rounded-[12px] font-['Plus_Jakarta_Sans',sans-serif] transition-colors"
            >
              <img src={googlePlayIcon} alt="" width="20" height="20" />
              Get on Android
            </a>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 12H21" stroke="#2f2f2f" strokeWidth="2" strokeLinecap="round"/>
                <path d="M3 6H21" stroke="#2f2f2f" strokeWidth="2" strokeLinecap="round"/>
                <path d="M3 18H21" stroke="#2f2f2f" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
