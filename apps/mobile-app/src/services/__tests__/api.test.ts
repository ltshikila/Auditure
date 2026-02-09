import { storageService } from '../storage.service';

// We need to re-import apiClient after mocks are set up
// The setup.ts file handles expo-secure-store and async-storage mocks

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after mocks
import { apiClient, ApiError } from '../api';

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Basic requests', () => {
    it('should make a GET request and return data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const result = await apiClient.get('/health');
      expect(result).toEqual({ data: 'test' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should make a POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await apiClient.post('/auth/login', { email: 'test@test.com', password: 'pass' });
      expect(result).toEqual({ success: true });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/auth/login');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ email: 'test@test.com', password: 'pass' });
    });

    it('should handle 204 No Content responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.reject(new Error('No body')),
      });

      const result = await apiClient.delete('/episodes/123', 'token');
      expect(result).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should throw ApiError with user-friendly message for 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials', error: 'Unauthorized' }),
      });

      await expect(apiClient.post('/auth/login', { email: 'a@b.com', password: 'wrong' }))
        .rejects.toMatchObject({
          statusCode: 401,
          message: 'Incorrect email or password. Please check your details and try again.',
        });
    });

    it('should throw ApiError with user-friendly message for 409 email conflict', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Email already registered' }),
      });

      await expect(apiClient.post('/auth/register', {}))
        .rejects.toMatchObject({
          statusCode: 409,
          message: 'This email is already registered. Please use a different email or try logging in.',
        });
    });

    it('should throw ApiError with user-friendly message for 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      });

      await expect(apiClient.get('/some-endpoint'))
        .rejects.toMatchObject({
          statusCode: 500,
          message: 'Something went wrong on our end. Please try again in a moment.',
        });
    });

    it('should return NETWORK_ERROR when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(apiClient.get('/health'))
        .rejects.toMatchObject({
          statusCode: 0,
          error: 'NETWORK_ERROR',
          message: 'Unable to connect. Please check your internet connection and try again.',
        });
    });

    it('should return NETWORK_ERROR for network request failed', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      await expect(apiClient.get('/test'))
        .rejects.toMatchObject({
          statusCode: 0,
          error: 'NETWORK_ERROR',
        });
    });
  });

  describe('Token refresh', () => {
    it('should attempt token refresh on 401 when token is present', async () => {
      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call: success
      jest.spyOn(storageService, 'getRefreshToken').mockResolvedValueOnce('valid-refresh');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
      });

      // Retry with new token: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'success' }),
      });

      const result = await apiClient.get('/protected', 'expired-token');
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(3); // original + refresh + retry
    });

    it('should not retry more than once on 401', async () => {
      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call: success
      jest.spyOn(storageService, 'getRefreshToken').mockResolvedValueOnce('valid-refresh');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
      });

      // Retry: still 401 — should NOT refresh again
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      await expect(apiClient.get('/protected', 'expired-token'))
        .rejects.toMatchObject({ statusCode: 401 });

      // Should be exactly 3 calls: original, refresh, retry (no second refresh)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should call onAuthFailure when refresh token is unavailable', async () => {
      const authFailureMock = jest.fn();
      apiClient.setOnAuthFailure(authFailureMock);

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // No refresh token
      jest.spyOn(storageService, 'getRefreshToken').mockResolvedValueOnce(null);

      await expect(apiClient.get('/protected', 'expired-token'))
        .rejects.toMatchObject({ statusCode: 401 });

      expect(authFailureMock).toHaveBeenCalled();

      // Clean up
      apiClient.setOnAuthFailure(null);
    });

    it('should call onAuthFailure when refresh request fails', async () => {
      const authFailureMock = jest.fn();
      apiClient.setOnAuthFailure(authFailureMock);

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call: fails
      jest.spyOn(storageService, 'getRefreshToken').mockResolvedValueOnce('expired-refresh');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid refresh token' }),
      });

      await expect(apiClient.get('/protected', 'expired-token'))
        .rejects.toMatchObject({ statusCode: 401 });

      expect(authFailureMock).toHaveBeenCalled();

      // Clean up
      apiClient.setOnAuthFailure(null);
    });

    it('should deduplicate concurrent refresh requests', async () => {
      let refreshCallCount = 0;

      // All initial calls: 401
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              accessToken: 'new-token',
              refreshToken: 'new-refresh',
            }),
          });
        }

        // First time each endpoint is called: 401
        // Retry after refresh: success
        const callCount = mockFetch.mock.calls.filter(
          (c: string[]) => c[0] === url
        ).length;

        if (callCount <= 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Unauthorized' }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'ok' }),
        });
      });

      jest.spyOn(storageService, 'getRefreshToken').mockResolvedValue('refresh-token');
      jest.spyOn(storageService, 'saveTokens').mockResolvedValue(undefined);

      // Fire 3 requests simultaneously
      await Promise.allSettled([
        apiClient.get('/a', 'expired'),
        apiClient.get('/b', 'expired'),
        apiClient.get('/c', 'expired'),
      ]);

      // The refresh endpoint should have been called only once due to deduplication
      expect(refreshCallCount).toBe(1);
    });
  });

  describe('Authorization header', () => {
    it('should include Bearer token when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await apiClient.get('/protected', 'my-token');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe('Bearer my-token');
    });

    it('should not include Authorization header when no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await apiClient.get('/public');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });
  });
});
