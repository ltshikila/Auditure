import agot from '@/assets/mock covers/agot.png';
import atomicHabits from '@/assets/mock covers/atomic_habits.png';
import debt from '@/assets/mock covers/debt.png';
import dune from '@/assets/mock covers/dune.png';
import itEndsWithUs from '@/assets/mock covers/it ends with us.png';
import laws from '@/assets/mock covers/laws.png';
import psychologyOfMoney from '@/assets/mock covers/psychology of money.png';
import sapiens from '@/assets/mock covers/sapiens.png';
import greatGatsby from '@/assets/mock covers/the great gatsby.png';
import leanStartup from '@/assets/mock covers/the lean startup.png';
import lorax from '@/assets/mock covers/the lorax.png';
import thinkingFastSlow from '@/assets/mock covers/thinking,fast and slow.png';

export type Cover = { src: string; title: string };

export const COVERS: Cover[] = [
  { src: greatGatsby, title: 'The Great Gatsby' },
  { src: laws, title: 'The Laws of Human Nature' },
  { src: dune, title: 'Dune' },
  { src: atomicHabits, title: 'Atomic Habits' },
  { src: itEndsWithUs, title: 'It Ends with Us' },
  { src: sapiens, title: 'Sapiens' },
  { src: agot, title: 'A Game of Thrones' },
  { src: psychologyOfMoney, title: 'The Psychology of Money' },
  { src: thinkingFastSlow, title: 'Thinking, Fast and Slow' },
  { src: debt, title: 'Debt' },
  { src: leanStartup, title: 'The Lean Startup' },
  { src: lorax, title: 'The Lorax' },
];
