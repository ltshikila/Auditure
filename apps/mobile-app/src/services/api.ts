import { storageService } from './storage.service';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Debug: Log the API base URL at startup
console.log('[API] Base URL:', API_BASE_URL);

/**
 * Resolve a cover image URL to an absolute URL.
 * Google Books URLs are already absolute (https://...), but locally extracted
 * covers use relative paths (/api/storage/...) that need the API base prepended.
 */
export function resolveCoverUrl(coverImageUrl: string | null | undefined): string | null {
  if (!coverImageUrl) return null;

  // Already an absolute URL (Google Books, etc.)
  if (coverImageUrl.startsWith('http://') || coverImageUrl.startsWith('https://')) {
    return coverImageUrl;
  }

  // Relative URL - prepend API base
  let resolved: string;
  if (coverImageUrl.startsWith('/')) {
    resolved = `${API_BASE_URL}${coverImageUrl}`;
  } else {
    // Fallback - treat as relative
    resolved = `${API_BASE_URL}/${coverImageUrl}`;
  }

  return resolved;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// Map technical API error messages to user-friendly messages
const getUserFriendlyMessage = (statusCode: number, apiMessage: string, _error?: string): string => {
  // Handle specific error types
  if (statusCode === 409) {
    if (apiMessage.toLowerCase().includes('email')) {
      return 'This email is already registered. Please use a different email or try logging in.';
    }
    return 'This information is already in use. Please try different details.';
  }

  if (statusCode === 401) {
    if (apiMessage.toLowerCase().includes('credential')) {
      return 'Incorrect email or password. Please check your details and try again.';
    }
    if (apiMessage.toLowerCase().includes('verification') || apiMessage.toLowerCase().includes('verify')) {
      return 'Please verify your email before logging in. Check your inbox for the verification code.';
    }
    return 'You need to log in to continue.';
  }

  if (statusCode === 400) {
    if (apiMessage.toLowerCase().includes('email')) {
      return 'Please check your email address and try again.';
    }
    if (apiMessage.toLowerCase().includes('password')) {
      return 'Your password must be at least 6 characters with uppercase, lowercase, and numbers.';
    }
    if (apiMessage.toLowerCase().includes('otp') || apiMessage.toLowerCase().includes('code')) {
      return 'Invalid or expired verification code. Please request a new one.';
    }
    if (apiMessage.toLowerCase().includes('subscription') || apiMessage.toLowerCase().includes('reactivat')) {
      return apiMessage;
    }
    if (apiMessage.toLowerCase().includes('limit') || apiMessage.toLowerCase().includes('quota') || apiMessage.toLowerCase().includes('upgrade')) {
      return apiMessage;
    }
    return apiMessage || 'Please check your information and try again.';
  }

  if (statusCode === 404) {
    return 'We couldn\'t find what you\'re looking for. Please try again.';
  }

  if (statusCode === 500) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }

  if (statusCode === 0) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  // Default user-friendly message for other errors
  if (statusCode >= 500) {
    return 'We\'re experiencing technical difficulties. Please try again later.';
  }

  // For client errors (4xx), try to make the message more friendly
  if (statusCode >= 400 && statusCode < 500) {
    return apiMessage || 'Please check your information and try again.';
  }

  return 'Something went wrong. Please try again.';
};

class ApiClient {
  // Generous enough to survive a Cloud Run cold start (~14s observed) plus
  // typical request latency, but short enough that a real network failure
  // surfaces quickly. A failed call gets one automatic retry, so the
  // effective worst-case wait is ~2x this.
  private static readonly REQUEST_TIMEOUT_MS = 30000;
  private static readonly NETWORK_RETRY_DELAY_MS = 1000;

  private baseUrl: string;
  private refreshPromise: Promise<string | null> | null = null;
  private onAuthFailure: (() => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setOnAuthFailure(callback: (() => void) | null) {
    this.onAuthFailure = callback;
  }

  private async attemptTokenRefresh(): Promise<string | null> {
    // If already refreshing, piggyback on the existing request
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await storageService.getRefreshToken();
        if (!refreshToken) {
          console.log('[API] No refresh token available');
          return null;
        }

        console.log('[API] Attempting token refresh...');
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          console.log('[API] Token refresh failed:', response.status);
          return null;
        }

        const data = await response.json();
        await storageService.saveTokens(data.accessToken, data.refreshToken);
        console.log('[API] Token refresh successful');
        return data.accessToken as string;
      } catch (error) {
        console.error('[API] Token refresh error:', error);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false,
    networkRetryAttempted = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Fail-fast timeout via AbortController so a stuck/intermittent connection
    // doesn't hang on the platform default. A fresh controller per attempt
    // means a retry isn't poisoned by the previous attempt's abort signal.
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      ApiClient.REQUEST_TIMEOUT_MS
    );

    try {
      console.log(`[API] ${options.method || 'GET'} ${url}`);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Handle 204 No Content responses (empty body)
      if (response.status === 204) {
        console.log(`[API Success] ${options.method || 'GET'} ${url} (204 No Content)`);
        return undefined as T;
      }

      const data = await response.json();

      if (!response.ok) {
        // If 401 with an auth token, try refreshing (once)
        const headers = options.headers as Record<string, string> | undefined;
        if (response.status === 401 && !isRetry && headers?.['Authorization']) {
          const newAccessToken = await this.attemptTokenRefresh();
          if (newAccessToken) {
            return this.request<T>(
              endpoint,
              {
                ...options,
                headers: {
                  ...headers,
                  Authorization: `Bearer ${newAccessToken}`,
                },
              },
              true
            );
          } else {
            // Refresh failed — force logout
            this.onAuthFailure?.();
          }
        }

        // Log the technical error for developers
        console.error(`[API Error] ${response.status}: ${data.message}`, data);

        // Create user-friendly error message
        const userFriendlyMessage = getUserFriendlyMessage(
          response.status,
          data.message || '',
          data.error
        );

        throw {
          message: userFriendlyMessage,
          statusCode: response.status,
          error: data.error,
        } as ApiError;
      }

      console.log(`[API Success] ${options.method || 'GET'} ${url}`);
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // If it's already an ApiError (server returned a non-2xx response),
      // re-throw without retrying. The server saw the request.
      if (error.message && error.statusCode) {
        throw error;
      }

      // Transient connectivity failure: either the request never reached the
      // server (TypeError from DNS/TCP/TLS failure) or our own timeout fired
      // before any response arrived (AbortError). Retry once after a short
      // backoff, since most transient mobile-network blips clear within a second.
      const isTransient =
        error.name === 'TypeError' || error.name === 'AbortError';
      if (isTransient && !networkRetryAttempted) {
        console.warn(
          `[API Retry] ${options.method || 'GET'} ${url} - ${error.name}, retrying in ${ApiClient.NETWORK_RETRY_DELAY_MS}ms`
        );
        await new Promise((r) =>
          setTimeout(r, ApiClient.NETWORK_RETRY_DELAY_MS)
        );
        return this.request<T>(endpoint, options, isRetry, true);
      }

      // Network or other errors
      console.error(`[Network Error] ${options.method || 'GET'} ${url}:`, error);

      throw {
        message: 'Unable to connect. Please check your internet connection and try again.',
        statusCode: 0,
        error: 'NETWORK_ERROR',
      } as ApiError;
    }
  }

  async get<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async post<T>(endpoint: string, body?: any, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async put<T>(endpoint: string, body?: any, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async patch<T>(endpoint: string, body?: any, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async delete<T>(endpoint: string, token?: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async uploadFormData<T>(
    endpoint: string,
    formData: FormData,
    token?: string,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    console.log(`[API] POST (multipart) ${url}`);
    console.log(`[API] Using XMLHttpRequest for better large file upload handling`);

    return this.executeUpload<T>(url, formData, token, onProgress);
  }

  private executeUpload<T>(
    url: string,
    formData: FormData,
    token?: string,
    onProgress?: (progress: number) => void,
    isRetry = false
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 10 minute timeout for large file uploads
      xhr.timeout = 600000;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          console.log(`[API] Upload progress: ${percentComplete}% (${event.loaded}/${event.total} bytes)`);
          onProgress?.(percentComplete);
        }
      };

      xhr.onload = async () => {
        console.log(`[API] Response received: ${xhr.status}`);

        // Handle 401 with token refresh (once)
        if (xhr.status === 401 && !isRetry && token) {
          try {
            const newToken = await this.attemptTokenRefresh();
            if (newToken) {
              resolve(await this.executeUpload<T>(url, formData, newToken, onProgress, true));
              return;
            } else {
              this.onAuthFailure?.();
            }
          } catch {
            // Fall through to normal error handling
          }
        }

        try {
          const data = JSON.parse(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300) {
            console.log(`[API Success] POST (multipart) ${url}`);
            resolve(data);
          } else {
            console.error(`[API Error] ${xhr.status}: ${data.message}`, data);

            const userFriendlyMessage = getUserFriendlyMessage(
              xhr.status,
              data.message || '',
              data.error
            );

            reject({
              message: userFriendlyMessage,
              statusCode: xhr.status,
              error: data.error,
            } as ApiError);
          }
        } catch {
          console.error(`[API] Failed to parse response:`, xhr.responseText);
          reject({
            message: 'Invalid response from server.',
            statusCode: xhr.status,
            error: 'PARSE_ERROR',
          } as ApiError);
        }
      };

      xhr.onerror = () => {
        console.error(`[Network Error] POST (multipart) ${url}: XMLHttpRequest error`);
        reject({
          message: 'Unable to connect. Please check your internet connection and try again.',
          statusCode: 0,
          error: 'NETWORK_ERROR',
        } as ApiError);
      };

      xhr.ontimeout = () => {
        console.error(`[Timeout Error] POST (multipart) ${url}: Request timed out`);
        reject({
          message: 'The upload is taking too long. Please try again with a smaller file.',
          statusCode: 0,
          error: 'TIMEOUT_ERROR',
        } as ApiError);
      };

      xhr.open('POST', url);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      console.log(`[API] Starting upload...`);
      xhr.send(formData);
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
