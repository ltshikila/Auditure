import { useState, type FormEvent } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface WaitlistFormProps {
  variant?: 'light' | 'dark';
  platform?: string;
  label?: string;
}

export function WaitlistForm({
  variant = 'light',
  platform = 'ios',
  label = 'Join iOS Waitlist',
}: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isDark = variant === 'dark';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'loading') return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, platform }),
      });

      if (res.ok) {
        setStatus('success');
        setEmail('');
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus('error');
      setErrorMsg(body.error || 'Something went wrong. Try again.');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Try again.');
    }
  }

  if (status === 'success') {
    return (
      <div
        className={`w-full max-w-md mx-auto flex items-start gap-3 p-4 rounded-[15px] ${
          isDark
            ? 'bg-white/10 border border-white/20'
            : 'bg-white border border-[#2f2f2f]/15 shadow-sm'
        }`}
      >
        <div
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
            isDark ? 'bg-white/15' : 'bg-[#920002]/10'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l5 5L20 7"
              stroke={isDark ? '#ffffff' : '#920002'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="text-left flex-1">
          <p
            className={`font-['DM_Serif_Display',serif] text-lg leading-tight ${
              isDark ? 'text-white' : 'text-[#2f2f2f]'
            }`}
          >
            Bookmarked.
          </p>
          <p
            className={`font-['Plus_Jakarta_Sans',sans-serif] text-sm mt-1 ${
              isDark ? 'text-white/70' : 'text-[#5a5a5a]'
            }`}
          >
            We'll email you the moment iOS ships. No spam, no teaser drips, just the launch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <label
        className={`flex flex-col sm:flex-row gap-2 p-1.5 rounded-[15px] cursor-text ${
          isDark
            ? 'bg-white/10 border border-white/20'
            : 'bg-white border border-[#2f2f2f]/15 shadow-sm'
        }`}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          disabled={status === 'loading'}
          className={`flex-1 min-w-0 px-4 py-3 bg-transparent outline-none font-['Plus_Jakarta_Sans',sans-serif] ${
            isDark
              ? 'text-white placeholder:text-white/50'
              : 'text-[#2f2f2f] placeholder:text-[#5a5a5a]'
          }`}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-[#920002] hover:bg-[#920002]/90 disabled:opacity-60 text-white px-6 py-3 rounded-[12px] font-['Plus_Jakarta_Sans',sans-serif] transition-colors whitespace-nowrap cursor-pointer"
        >
          {status === 'loading' ? 'Joining...' : label}
        </button>
      </label>
      {status === 'error' && (
        <p
          className={`mt-2 text-sm font-['Plus_Jakarta_Sans',sans-serif] text-center ${
            isDark ? 'text-red-300' : 'text-[#920002]'
          }`}
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}
