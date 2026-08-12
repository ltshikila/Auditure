import { Link } from "react-router";
import appLogo from 'figma:asset/9d4b5c5fc52fec774c788c231ec86fca8166a560.png';

export function Footer() {
  return (
    <footer className="bg-[#0E0B09] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-4 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={appLogo} alt="Auditure" className="w-10 h-10 brightness-150 saturate-150" />
              <h3 className="font-['EB_Garamond',serif] text-white text-2xl">Auditure</h3>
            </div>
            <p className="font-['EB_Garamond',serif] text-white/60 text-sm mb-4">
              Create your own Virtual Podcaster. Turn any book into engaging podcast episodes.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="label-caps text-white/50 mb-5">Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="/#how-it-works" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="/#features" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="/#listen" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  Listen
                </a>
              </li>
              <li>
                <a href="/#pricing" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/#faq" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <Link to="/about" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="label-caps text-white/50 mb-5">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="label-caps text-white/50 mb-5">Connect</h4>
            <ul className="space-y-2">
              {[
                { label: 'X (Twitter)', href: 'https://x.com/auditurestudios' },
                { label: 'TikTok', href: 'https://www.tiktok.com/@auditure_studios' },
                { label: 'Contact Us', href: 'mailto:support@auditure.app' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="font-['EB_Garamond',serif] text-white/60 hover:text-white text-sm transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10">
          <p className="font-['EB_Garamond',serif] text-white/40 text-sm">
            &copy; 2026 Auditure. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
