const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// Map technical API error messages to user-friendly messages
const getUserFriendlyMessage = (statusCode: number, apiMessage: string, error?: string): string => {
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
    return 'Please check your information and try again.';
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
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      console.log(`[API] ${options.method || 'GET'} ${url}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
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
      // If it's already an ApiError, re-throw it
      if (error.message && error.statusCode) {
        throw error;
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

  async delete<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
