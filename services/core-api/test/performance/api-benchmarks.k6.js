import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test credentials - override via environment variables
const TEST_EMAIL    = __ENV.TEST_EMAIL    || 'perf-test@auditure.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'PerformanceTest123!';

// A known-public episode ID for read-only endpoints. Override if needed.
const SAMPLE_EPISODE_ID = __ENV.SAMPLE_EPISODE_ID || '';

// Custom metrics
const loginFailRate = new Rate('login_failures');
const feedLatency   = new Trend('feed_latency', true);

// ---------------------------------------------------------------------------
// Scenarios & thresholds
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // Smoke test: single VU, lightweight sanity check
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      exec: 'smokeTest',
      tags: { scenario: 'smoke' },
    },

    // Load test: ramp up to 50 VUs exercising authenticated flows
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m',  target: 50 },
        { duration: '2m',  target: 50 },
        { duration: '30s', target: 0  },
      ],
      exec: 'loadTest',
      startTime: '35s', // start after smoke finishes
      tags: { scenario: 'load' },
    },
  },

  thresholds: {
    // Global HTTP duration thresholds
    http_req_duration: [
      'p(95)<500',   // 95th percentile under 500 ms
      'p(99)<1000',  // 99th percentile under 1 s
    ],
    // Custom thresholds
    login_failures: ['rate<0.05'],          // less than 5 % login failures
    feed_latency:   ['p(95)<500'],          // feed endpoint p95 under 500 ms
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Authenticate and return a JWT access token.
 * Returns null when login fails so callers can skip authenticated work.
 */
function authenticate() {
  const payload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: jsonHeaders(),
    tags: { name: 'POST /auth/login' },
  });

  const ok = check(res, {
    'login status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login returns accessToken': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!body.accessToken;
      } catch (_) {
        return false;
      }
    },
  });

  loginFailRate.add(!ok);

  if (!ok) {
    return null;
  }

  return JSON.parse(res.body).accessToken;
}

// ---------------------------------------------------------------------------
// Smoke test (public, unauthenticated endpoints)
// ---------------------------------------------------------------------------

export function smokeTest() {
  group('Health check', () => {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { name: 'GET /health' },
    });

    check(res, {
      'health status 200': (r) => r.status === 200,
      'health body contains status': (r) => {
        try {
          return JSON.parse(r.body).status === 'healthy';
        } catch (_) {
          return false;
        }
      },
    });
  });

  group('Public episodes', () => {
    const res = http.get(`${BASE_URL}/episodes/public?sortBy=popular&page=1&limit=20`, {
      tags: { name: 'GET /episodes/public' },
    });

    check(res, {
      'public episodes status 200': (r) => r.status === 200,
      'public episodes returns array or object': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) || typeof body === 'object';
        } catch (_) {
          return false;
        }
      },
    });
  });

  group('Trending episodes', () => {
    const res = http.get(`${BASE_URL}/episodes/trending?limit=10`, {
      tags: { name: 'GET /episodes/trending' },
    });

    check(res, {
      'trending status 200': (r) => r.status === 200,
      'trending returns data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) || typeof body === 'object';
        } catch (_) {
          return false;
        }
      },
    });
  });

  group('Search', () => {
    const res = http.get(`${BASE_URL}/search?q=philosophy&scope=all&page=1&limit=10`, {
      tags: { name: 'GET /search' },
    });

    check(res, {
      'search status 200': (r) => r.status === 200,
    });
  });

  group('Search suggestions', () => {
    const res = http.get(`${BASE_URL}/search/suggestions?q=phi&limit=5`, {
      tags: { name: 'GET /search/suggestions' },
    });

    check(res, {
      'suggestions status 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

// ---------------------------------------------------------------------------
// Load test (authenticated endpoints)
// ---------------------------------------------------------------------------

export function loadTest() {
  // ---- Authenticate ----
  const token = authenticate();
  if (!token) {
    sleep(1);
    return; // skip iteration when auth fails
  }

  // ---- Feed: episodes tab ----
  group('Feed - episodes tab', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/feed?tab=episodes`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /feed?tab=episodes' },
    });
    feedLatency.add(Date.now() - start);

    check(res, {
      'feed episodes status 200': (r) => r.status === 200,
      'feed has sections': (r) => {
        try {
          return JSON.parse(r.body).sections !== undefined;
        } catch (_) {
          return false;
        }
      },
    });
  });

  // ---- Feed: books tab ----
  group('Feed - books tab', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/feed?tab=books`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /feed?tab=books' },
    });
    feedLatency.add(Date.now() - start);

    check(res, {
      'feed books status 200': (r) => r.status === 200,
    });
  });

  // ---- Feed: podcasters tab ----
  group('Feed - podcasters tab', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/feed?tab=podcasters`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /feed?tab=podcasters' },
    });
    feedLatency.add(Date.now() - start);

    check(res, {
      'feed podcasters status 200': (r) => r.status === 200,
    });
  });

  // ---- Feed section pagination ----
  group('Feed section - popular', () => {
    const res = http.get(`${BASE_URL}/feed/section/popular?page=1&limit=20`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /feed/section/popular' },
    });

    check(res, {
      'section popular status 200': (r) => r.status === 200,
    });
  });

  // ---- My episodes ----
  group('My episodes', () => {
    const res = http.get(`${BASE_URL}/episodes/my`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /episodes/my' },
    });

    check(res, {
      'my episodes status 200': (r) => r.status === 200,
    });
  });

  // ---- Liked episodes ----
  group('Liked episodes', () => {
    const res = http.get(`${BASE_URL}/episodes/liked`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /episodes/liked' },
    });

    check(res, {
      'liked episodes status 200': (r) => r.status === 200,
    });
  });

  // ---- Profile ----
  group('Auth profile', () => {
    const res = http.get(`${BASE_URL}/auth/me`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /auth/me' },
    });

    check(res, {
      'profile status 200': (r) => r.status === 200,
    });
  });

  // ---- Save playback progress (requires a valid episode ID) ----
  if (SAMPLE_EPISODE_ID) {
    group('Save progress', () => {
      const payload = JSON.stringify({ position: Math.floor(Math.random() * 300) });
      const res = http.post(
        `${BASE_URL}/episodes/${SAMPLE_EPISODE_ID}/progress`,
        payload,
        {
          headers: jsonHeaders(token),
          tags: { name: 'POST /episodes/:id/progress' },
        },
      );

      check(res, {
        'save progress status 204': (r) => r.status === 204,
      });
    });

    group('Get progress', () => {
      const res = http.get(
        `${BASE_URL}/episodes/${SAMPLE_EPISODE_ID}/progress`,
        {
          headers: jsonHeaders(token),
          tags: { name: 'GET /episodes/:id/progress' },
        },
      );

      check(res, {
        'get progress status 200': (r) => r.status === 200,
      });
    });
  } else {
    // When no sample episode is available, exercise the public listing
    // and attempt progress against the first available episode.
    group('Save progress (dynamic)', () => {
      const listRes = http.get(`${BASE_URL}/episodes/public?sortBy=popular&limit=1`, {
        tags: { name: 'GET /episodes/public (for progress)' },
      });

      let episodeId = null;
      try {
        const body = JSON.parse(listRes.body);
        const episodes = Array.isArray(body) ? body : body.data || body.episodes || [];
        if (episodes.length > 0) {
          episodeId = episodes[0].id;
        }
      } catch (_) {
        // ignore parse errors
      }

      if (episodeId) {
        const payload = JSON.stringify({ position: Math.floor(Math.random() * 300) });
        const res = http.post(
          `${BASE_URL}/episodes/${episodeId}/progress`,
          payload,
          {
            headers: jsonHeaders(token),
            tags: { name: 'POST /episodes/:id/progress' },
          },
        );

        check(res, {
          'save progress status 204': (r) => r.status === 204,
        });
      }
    });
  }

  // ---- Search (authenticated, sees private content too) ----
  group('Authenticated search', () => {
    const queries = ['science', 'history', 'self-help', 'technology', 'philosophy'];
    const q = queries[Math.floor(Math.random() * queries.length)];

    const res = http.get(`${BASE_URL}/search?q=${q}&scope=all&page=1&limit=10`, {
      headers: jsonHeaders(token),
      tags: { name: 'GET /search (auth)' },
    });

    check(res, {
      'auth search status 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
