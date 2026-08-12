import { useEffect, useRef, useState, type ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  /** Stagger within a group. Keep small; this is a settle, not a queue. */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
};

/*
 * A page settling rather than a slide-in. 16px of rise and 650ms, which is
 * about the shortest distance that still reads as motion. The SaaS default of
 * 60px over 900ms makes the reader wait for content they already scrolled to.
 *
 * Fires once and disconnects: re-animating on the way back up draws attention
 * to the mechanism instead of the page.
 */
export function Reveal({ children, delay = 0, className = '', as = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Honour the OS setting, and never leave content hidden behind a feature
    // that was asked to be switched off.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      // Start a little before the element is fully on screen so it has settled
      // by the time it is properly in view.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as as 'div';

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={`reveal${shown ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
