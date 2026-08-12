/*
 * Single source of truth for the chapter sequence. The contents page and the
 * running head both read from this, so a renumbering can't leave them
 * disagreeing with each other.
 */
export type Chapter = { numeral: string; title: string; href: string };

export const CHAPTERS: Chapter[] = [
  { numeral: 'I', title: 'How It Works', href: '#how-it-works' },
  { numeral: 'II', title: 'Features', href: '#features' },
  { numeral: 'III', title: 'Inside the App', href: '#screenshots' },
  { numeral: 'IV', title: 'Community', href: '#community' },
  { numeral: 'V', title: 'Listen', href: '#listen' },
  { numeral: 'VI', title: 'Pricing', href: '#pricing' },
  { numeral: 'VII', title: 'Questions', href: '#faq' },
];
