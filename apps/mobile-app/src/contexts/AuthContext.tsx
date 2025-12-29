import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User, RegisterData, LoginData, VerifyData } from '../services/auth.service';
import { storageService } from '../services/storage.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  register: (data: RegisterData) => Promise<{ email: string }>;
  login: (data: LoginData) => Promise<{ requiresVerification?: boolean; email?: string }>;
  verify: (data: VerifyData) => Promise<void>;
  logout: () => Promise<void>;
  resendOTP: (email: string) => Promise<void>;
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
  }, []);

  const checkAuthStatus = async () => {
    try {
      const savedUser = await storageService.getUser();
      const accessToken = await storageService.getAccessToken();

      if (savedUser && accessToken) {
        try {
          const currentUser = await authService.getProfile(accessToken);
          setUser(currentUser);
        } catch (error) {
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
    await storageService.clearAll();
    setUser(null);
  };

  const resendOTP = async (email: string) => {
    await authService.resendOTP(email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        register,
        login,
        verify,
        logout,
        resendOTP,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
