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
      <p
        className={`font-['Plus_Jakarta_Sans',sans-serif] text-sm ${
          isDark ? 'text-white/90' : 'text-[#2f2f2f]'
        }`}
      >
        You're on the list. We'll email you the moment iOS goes live.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div
        className={`flex flex-col sm:flex-row gap-2 p-1.5 rounded-[15px] ${
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
          className={`flex-1 px-4 py-3 bg-transparent outline-none font-['Plus_Jakarta_Sans',sans-serif] ${
            isDark
              ? 'text-white placeholder:text-white/50'
              : 'text-[#2f2f2f] placeholder:text-[#5a5a5a]'
          }`}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-[#920002] hover:bg-[#920002]/90 disabled:opacity-60 text-white px-6 py-3 rounded-[12px] font-['Plus_Jakarta_Sans',sans-serif] transition-colors whitespace-nowrap"
        >
          {status === 'loading' ? 'Joining...' : label}
        </button>
      </div>
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
