interface Env {
  RESEND_API_KEY: string;
  RESEND_AUDIENCE_ID: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    return json({ error: 'Waitlist not configured' }, 500);
  }

  let body: { email?: unknown; platform?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const platform = typeof body.platform === 'string' ? body.platform.slice(0, 32) : 'unknown';

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Invalid email' }, 400);
  }

  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        first_name: platform,
        unsubscribed: false,
      }),
    },
  );

  if (res.ok) return json({ ok: true });

  const text = await res.text();
  if (res.status === 409 || /already exists/i.test(text)) {
    return json({ ok: true, duplicate: true });
  }

  return json({ error: 'Signup failed' }, 502);
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
