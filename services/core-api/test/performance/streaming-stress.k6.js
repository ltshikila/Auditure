import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// A public episode ID whose audio can be streamed.
// Pass via: k6 run -e EPISODE_ID=<uuid> streaming-stress.k6.js
const EPISODE_ID = __ENV.EPISODE_ID || '';

// Auth credentials (streaming may require auth depending on episode visibility)
const TEST_EMAIL    = __ENV.TEST_EMAIL    || 'perf-test@auditure.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'PerformanceTest123!';

// Assumed approximate audio file size in bytes (10 MB default).
// Adjust with -e AUDIO_SIZE_BYTES=<n> for more realistic ranges.
const AUDIO_SIZE_BYTES = parseInt(__ENV.AUDIO_SIZE_BYTES || '10485760', 10);

// Custom metrics
const streamFailRate       = new Rate('stream_failures');
const partialContentRate   = new Rate('partial_content_206');
const bytesReceived        = new Counter('stream_bytes_received');
const rangeRequestLatency  = new Trend('range_request_latency', true);

// ---------------------------------------------------------------------------
// Scenarios & thresholds
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    streaming_stress: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      exec: 'streamingStress',
    },
  },

  thresholds: {
    // Streaming p95 under 2 seconds
    range_request_latency: ['p(95)<2000'],
    // Less than 1 % failure rate
    stream_failures: ['rate<0.01'],
    // At least 90 % of range requests should yield 206
    partial_content_206: ['rate>0.90'],
    // Overall HTTP duration as a safety net
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a random byte-range header value.
 * Generates ranges of 64 KB -- 512 KB at random offsets within the file.
 */
function randomRangeHeader() {
  const chunkMin = 64 * 1024;       // 64 KB
  const chunkMax = 512 * 1024;      // 512 KB
  const chunkSize = Math.floor(Math.random() * (chunkMax - chunkMin + 1)) + chunkMin;

  const maxStart = Math.max(0, AUDIO_SIZE_BYTES - chunkSize);
  const start = Math.floor(Math.random() * (maxStart + 1));
  const end = Math.min(start + chunkSize - 1, AUDIO_SIZE_BYTES - 1);

  return `bytes=${start}-${end}`;
}

/**
 * Authenticate and return a JWT access token (or null on failure).
 */
function authenticate() {
  const payload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /auth/login (stream)' },
  });

  const ok = check(res, {
    'stream auth status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  if (!ok) {
    return null;
  }

  try {
    return JSON.parse(res.body).accessToken;
  } catch (_) {
    return null;
  }
}

/**
 * Resolve an episode ID to use for streaming.
 * If EPISODE_ID is provided via env, use it directly.
 * Otherwise, fetch the first public episode.
 */
function resolveEpisodeId() {
  if (EPISODE_ID) {
    return EPISODE_ID;
  }

  const res = http.get(`${BASE_URL}/episodes/public?sortBy=popular&limit=5`, {
    tags: { name: 'GET /episodes/public (resolve)' },
  });

  try {
    const body = JSON.parse(res.body);
    const episodes = Array.isArray(body) ? body : body.data || body.episodes || [];
    // Pick a random one from the top results so VUs spread across episodes
    if (episodes.length > 0) {
      const idx = Math.floor(Math.random() * episodes.length);
      return episodes[idx].id;
    }
  } catch (_) {
    // ignore
  }

  return null;
}

// ---------------------------------------------------------------------------
// Streaming stress test
// ---------------------------------------------------------------------------

export function streamingStress() {
  // Authenticate (streaming uses OptionalJwtAuthGuard, but auth may be
  // needed for private episodes or premium-gated content)
  const token = authenticate();

  const episodeId = resolveEpisodeId();
  if (!episodeId) {
    console.warn('No episode ID available for streaming test. Skipping iteration.');
    streamFailRate.add(true);
    sleep(1);
    return;
  }

  const streamUrl = `${BASE_URL}/episodes/${episodeId}/stream`;

  // --- Initial request without Range to establish baseline & get content-length ---
  group('Initial stream request', () => {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = http.get(streamUrl, {
      headers: headers,
      tags: { name: 'GET /episodes/:id/stream (no range)' },
    });

    const ok = check(res, {
      'initial stream status 200 or 206': (r) => r.status === 200 || r.status === 206,
      'initial stream has content-type': (r) => {
        const ct = r.headers['Content-Type'] || '';
        return ct.includes('audio') || ct.includes('octet-stream');
      },
    });

    streamFailRate.add(!ok);
  });

  // --- Range requests: simulate seeking / chunked playback ---
  const numRangeRequests = 5 + Math.floor(Math.random() * 6); // 5-10 range requests per VU iteration

  group('Range requests', () => {
    for (let i = 0; i < numRangeRequests; i++) {
      const rangeHeader = randomRangeHeader();
      const headers = { Range: rangeHeader };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const start = Date.now();
      const res = http.get(streamUrl, {
        headers: headers,
        tags: { name: 'GET /episodes/:id/stream (range)' },
      });
      const elapsed = Date.now() - start;
      rangeRequestLatency.add(elapsed);

      const is206 = res.status === 206;
      partialContentRate.add(is206);

      const ok = check(res, {
        'range request returns 206 Partial Content': (r) => r.status === 206,
        'range response has Content-Range header': (r) => {
          return !!r.headers['Content-Range'];
        },
        'range response has audio content-type': (r) => {
          const ct = r.headers['Content-Type'] || '';
          return ct.includes('audio') || ct.includes('octet-stream');
        },
      });

      streamFailRate.add(!ok);

      // Track bytes received
      if (res.body) {
        bytesReceived.add(res.body.length);
      }

      // Small pause between range requests to simulate real playback seeking
      sleep(0.1 + Math.random() * 0.3);
    }
  });

  // --- Simulate rapid seek (burst of range requests) ---
  group('Rapid seek burst', () => {
    const burstCount = 3;
    for (let i = 0; i < burstCount; i++) {
      const rangeHeader = randomRangeHeader();
      const headers = { Range: rangeHeader };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const start = Date.now();
      const res = http.get(streamUrl, {
        headers: headers,
        tags: { name: 'GET /episodes/:id/stream (seek burst)' },
      });
      const elapsed = Date.now() - start;
      rangeRequestLatency.add(elapsed);

      partialContentRate.add(res.status === 206);

      check(res, {
        'seek burst returns 206': (r) => r.status === 206,
      });

      // No sleep between burst requests - simulate rapid seeking
    }
  });

  // --- Edge cases ---
  group('Edge case: first byte', () => {
    const headers = { Range: 'bytes=0-0' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = http.get(streamUrl, {
      headers: headers,
      tags: { name: 'GET /episodes/:id/stream (first byte)' },
    });

    partialContentRate.add(res.status === 206);

    check(res, {
      'first byte request returns 206': (r) => r.status === 206,
      'first byte response is 1 byte': (r) => {
        const contentLength = r.headers['Content-Length'];
        return contentLength === '1' || (r.body && r.body.length === 1);
      },
    });
  });

  group('Edge case: open-ended range', () => {
    // Request from a midpoint to the end (no upper bound)
    const midpoint = Math.floor(AUDIO_SIZE_BYTES / 2);
    const headers = { Range: `bytes=${midpoint}-` };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = http.get(streamUrl, {
      headers: headers,
      tags: { name: 'GET /episodes/:id/stream (open range)' },
    });

    partialContentRate.add(res.status === 206);

    check(res, {
      'open-ended range returns 206 or 200': (r) => r.status === 206 || r.status === 200,
    });
  });

  sleep(0.5);
}
