import { Link } from "react-router";
import appLogo from 'figma:asset/9d4b5c5fc52fec774c788c231ec86fca8166a560.png';

export function Footer() {
  return (
    <footer className="bg-[#191815] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-4 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={appLogo} alt="Auditure" className="w-10 h-10" />
              <h3 className="font-['DM_Serif_Display',serif] text-white text-2xl">Auditure</h3>
            </div>
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 text-sm mb-4">
              Create your own AI podcaster. Turn any book into engaging podcast episodes.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-white mb-4">Product</h4>
            <ul className="space-y-2">
              {[
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Features', href: '#features' },
                { label: 'Community', href: '#community' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 hover:text-white text-sm transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 hover:text-white text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 hover:text-white text-sm transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-white mb-4">Connect</h4>
            <ul className="space-y-2">
              {[
                { label: 'X (Twitter)', href: 'https://x.com/auditurestudios' },
                { label: 'Reddit', href: 'https://www.reddit.com/user/Grouchy_Slice_1379/' },
                { label: 'Contact Us', href: 'mailto:support@auditure.app' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="font-['Plus_Jakarta_Sans',sans-serif] text-white/60 hover:text-white text-sm transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/40 text-sm">
            &copy; 2026 Auditure. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
