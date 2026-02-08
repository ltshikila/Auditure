import { apiClient } from './api';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface VerifyData {
  email: string;
  code: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  email: string;
}

export interface LoginResponseWithVerification {
  requiresVerification: true;
  message: string;
  email: string;
}

export type LoginResponse = AuthResponse | LoginResponseWithVerification;

export interface VerifyResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

class AuthService {
  async register(data: RegisterData): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/auth/register', data);
  }

  async login(data: LoginData): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', data);
  }

  async verify(data: VerifyData): Promise<VerifyResponse> {
    return apiClient.post<VerifyResponse>('/auth/verify', data);
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return apiClient.post('/auth/refresh', { refreshToken });
  }

  async resendOTP(email: string): Promise<{ message: string }> {
    return apiClient.post('/auth/resend-otp', { email });
  }

  async getProfile(token: string): Promise<User> {
    return apiClient.get<User>('/auth/me', token);
  }
}

export const authService = new AuthService();
