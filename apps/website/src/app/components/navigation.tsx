import { useEffect, useState } from "react";
import { Link } from "react-router";
import appLogo from 'figma:asset/9d4b5c5fc52fec774c788c231ec86fca8166a560.png';
import googlePlayIcon from '@/assets/google-play-icon.svg';

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.auditure.app";

type NavItem =
  | { label: string; href: string; type: "anchor" }
  | { label: string; to: string; type: "route" };

const NAV_ITEMS: NavItem[] = [
  { label: "How It Works", href: "/#how-it-works", type: "anchor" },
  { label: "Features", href: "/#features", type: "anchor" },
  { label: "Listen", href: "/#listen", type: "anchor" },
  { label: "Pricing", href: "/#pricing", type: "anchor" },
  { label: "About", to: "/about", type: "route" },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  // Lock body scroll while menu is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // Close menu on escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <>
    <nav className="relative z-40 bg-[#1A1512] border-b border-[#EDE4D6]/12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={close}>
            <img src={appLogo} alt="Auditure" className="w-10 h-10 brightness-150 saturate-150" />
            <span className="font-['EB_Garamond',serif] text-[#EDE4D6] text-2xl">Auditure</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) =>
              item.type === "anchor" ? (
                <a
                  key={item.label}
                  href={item.href}
                  className="font-['EB_Garamond',serif] text-[#EDE4D6] hover:text-[#C2A14D] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  className="font-['EB_Garamond',serif] text-[#EDE4D6] hover:text-[#C2A14D] transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          {/* CTA Button */}
          <div className="flex items-center gap-4">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 gilt bg-[#C2A14D] hover:bg-[#D9B863] text-[#1A1512] px-6 py-3 rounded-[2px] btn-label transition-colors"
            >
              <img src={googlePlayIcon} alt="" width="20" height="20" />
              Get on Android
            </a>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen((v) => !v)}
              className="md:hidden p-2"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18" stroke="#EDE4D6" strokeWidth="2" strokeLinecap="round" />
                  <path d="M18 6L6 18" stroke="#EDE4D6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12H21" stroke="#EDE4D6" strokeWidth="2" strokeLinecap="round" />
                  <path d="M3 6H21" stroke="#EDE4D6" strokeWidth="2" strokeLinecap="round" />
                  <path d="M3 18H21" stroke="#EDE4D6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

    </nav>

    {/* Mobile Menu Overlay - sibling to nav to escape its stacking context */}
    {isOpen && (
      <div className="md:hidden fixed inset-x-0 top-20 bottom-0 z-40 bg-[#1A1512] border-t border-[#EDE4D6]/12 overflow-y-auto">
        <div className="px-4 sm:px-6 py-6 flex flex-col gap-1">
          {NAV_ITEMS.map((item) =>
            item.type === "anchor" ? (
              <a
                key={item.label}
                href={item.href}
                onClick={close}
                className="font-['EB_Garamond',serif] text-[#EDE4D6] hover:text-[#C2A14D] hover:bg-[#221A16] text-lg py-4 px-3 rounded-[2px] transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                onClick={close}
                className="font-['EB_Garamond',serif] text-[#EDE4D6] hover:text-[#C2A14D] hover:bg-[#221A16] text-lg py-4 px-3 rounded-[2px] transition-colors"
              >
                {item.label}
              </Link>
            )
          )}

          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="mt-4 flex items-center justify-center gap-2 gilt bg-[#C2A14D] hover:bg-[#D9B863] text-[#1A1512] px-6 py-4 rounded-[2px] btn-label transition-colors"
          >
            <img src={googlePlayIcon} alt="" width="20" height="20" />
            Get on Android
          </a>
        </div>
      </div>
    )}
    </>
  );
}
