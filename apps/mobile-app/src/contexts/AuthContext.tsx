import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User, RegisterData, LoginData, VerifyData } from '../services/auth.service';
import { notificationService } from '../services/notification.service';
import { storageService } from '../services/storage.service';
import { apiClient } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  getAccessToken: () => Promise<string | null>;
  register: (data: RegisterData) => Promise<{ email: string }>;
  login: (data: LoginData) => Promise<{ requiresVerification?: boolean; email?: string }>;
  verify: (data: VerifyData) => Promise<void>;
  logout: () => Promise<void>;
  resendOTP: (email: string) => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();

    // When refresh token is also expired/invalid, force logout
    apiClient.setOnAuthFailure(async () => {
      await storageService.clearAll();
      setUser(null);
    });
  }, []);

  const checkAuthStatus = async () => {
    try {
      const savedUser = await storageService.getUser();
      const accessToken = await storageService.getAccessToken();

      if (savedUser && accessToken) {
        try {
          const currentUser = await authService.getProfile(accessToken);
          setUser(currentUser);
        } catch {
          const refreshToken = await storageService.getRefreshToken();
          if (refreshToken) {
            try {
              const tokens = await authService.refreshToken(refreshToken);
              await storageService.saveTokens(tokens.accessToken, tokens.refreshToken);
              const currentUser = await authService.getProfile(tokens.accessToken);
              setUser(currentUser);
            } catch {
              await storageService.clearAll();
              setUser(null);
            }
          } else {
            await storageService.clearAll();
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    const response = await authService.register(data);
    return { email: response.email };
  };

  const login = async (data: LoginData) => {
    const response = await authService.login(data);

    if ('requiresVerification' in response && response.requiresVerification) {
      return { requiresVerification: true, email: response.email };
    }

    // TypeScript now knows response is AuthResponse
    if ('accessToken' in response) {
      await storageService.saveTokens(response.accessToken, response.refreshToken);
      await storageService.saveUser(response.user);
      setUser(response.user);
    }
    return {};
  };

  const verify = async (data: VerifyData) => {
    const response = await authService.verify(data);
    await storageService.saveTokens(response.accessToken, response.refreshToken);
    await storageService.saveUser(response.user);
    setUser(response.user);
  };

  const logout = async () => {
    // Clear push token on backend before wiping local tokens
    try {
      const token = await storageService.getAccessToken();
      if (token) {
        await notificationService.clearPushToken(token);
      }
    } catch (error) {
      console.error('[Auth] Failed to clear push token on logout:', error);
    }
    await storageService.clearAll();
    setUser(null);
  };

  const resendOTP = async (email: string) => {
    await authService.resendOTP(email);
  };

  const forgotPassword = async (email: string) => {
    await authService.forgotPassword(email);
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    await authService.resetPassword({ email, code, newPassword });
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  };

  const getAccessToken = async (): Promise<string | null> => {
    return storageService.getAccessToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        getAccessToken,
        register,
        login,
        verify,
        logout,
        resendOTP,
        updateUser,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
