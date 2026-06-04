import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { LoginResponseData, User } from '~/types';
import { api } from '~/utils/api';
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from '~/utils/authStorage';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredAuthToken());
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredAuthToken());
  const [isLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponseData>('/api/session/login', {
      email,
      password,
      captchaToken: '',
      platform: 'web',
    });
    const { token: newToken, user } = res.data!;
    setStoredAuthToken(newToken);
    setToken(newToken);
    setIsAuthenticated(true);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.get('/api/session/logout');
    } catch {
      // Ignore logout errors
    }
    clearStoredAuthToken();
    setToken(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, isLoading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
