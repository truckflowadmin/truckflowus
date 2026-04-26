import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, setToken, getToken, clearToken } from './api';

interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  driverName: string | null;
  driverId: string | null;
}

interface AuthContextType extends AuthState {
  login: (phone: string, pin: string) => Promise<{ ok: boolean; error?: string; locked?: boolean; hasSecurityQuestions?: boolean; hasEmail?: boolean; attemptsLeft?: number }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    driverName: null,
    driverId: null,
  });

  const checkSession = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setState({ isLoading: false, isLoggedIn: false, driverName: null, driverId: null });
        return;
      }
      // Validate by fetching profile
      const profile = await apiFetch('/api/driver/profile');
      setState({
        isLoading: false,
        isLoggedIn: true,
        driverName: profile.name,
        driverId: profile.id,
      });
    } catch (err: any) {
      console.warn('[Auth] Session check failed:', err.message);
      await clearToken();
      setState({ isLoading: false, isLoggedIn: false, driverName: null, driverId: null });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (phone: string, pin: string) => {
    try {
      const res = await apiFetch('/api/driver/auth', {
        method: 'POST',
        body: { action: 'login', phone, pin, platform: 'mobile' },
        noAuth: true,
      });

      if (res.ok && res.token) {
        await setToken(res.token);
        setState({
          isLoading: false,
          isLoggedIn: true,
          driverName: res.driverName,
          driverId: res.driverId,
        });
        return { ok: true };
      }

      return { ok: false, error: res.error || 'Login failed' };
    } catch (err: any) {
      const data = err.data || {};
      return {
        ok: false,
        error: data.message || err.message || 'Login failed. Check your connection.',
        locked: data.error === 'locked',
        hasSecurityQuestions: data.hasSecurityQuestions,
        hasEmail: data.hasEmail,
        attemptsLeft: data.attemptsLeft,
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/driver/auth', {
        method: 'POST',
        body: { action: 'logout' },
      });
    } catch {
      // Ignore — we're logging out anyway
    }
    await clearToken();
    setState({ isLoading: false, isLoggedIn: false, driverName: null, driverId: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
