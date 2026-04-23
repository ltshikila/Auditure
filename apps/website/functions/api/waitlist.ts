interface Env {
  RESEND_API_KEY: string;
  RESEND_AUDIENCE_ID: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERSION = 'v3-diagnostic';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const apiKey = (env.RESEND_API_KEY || '').trim();
  const audienceId = (env.RESEND_AUDIENCE_ID || '').trim();
  return json({
    version: VERSION,
    hasApiKey: apiKey.length > 0,
    apiKeyLength: apiKey.length,
    hasAudienceId: audienceId.length > 0,
    audienceIdLength: audienceId.length,
    audienceIdLooksLikeUuid: /^[0-9a-f-]{36}$/i.test(audienceId),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const apiKey = (env.RESEND_API_KEY || '').trim();
    const audienceId = (env.RESEND_AUDIENCE_ID || '').trim();

    if (!apiKey || !audienceId) {
      return json({ error: 'Waitlist not configured', version: VERSION }, 500);
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let res: Response;
    try {
      res = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            first_name: platform,
            unsubscribed: false,
          }),
          signal: controller.signal,
        },
      );
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('Resend fetch failed', msg);
      return json({ error: 'Upstream fetch failed', detail: msg, version: VERSION }, 502);
    }
    clearTimeout(timeoutId);

    if (res.ok) return json({ ok: true, version: VERSION });

    const text = await res.text();
    if (res.status === 409 || /already exists/i.test(text)) {
      return json({ ok: true, duplicate: true, version: VERSION });
    }

    console.error('Resend API error', res.status, text);
    return json({ error: 'Signup failed', status: res.status, detail: text.slice(0, 200), version: VERSION }, 502);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error('Waitlist function crashed', msg);
    return json({ error: 'Server error', detail: msg, version: VERSION }, 500);
  }
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
