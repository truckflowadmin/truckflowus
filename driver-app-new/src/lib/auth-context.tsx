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
        driverName: profile.driver?.name || profile.name,
        driverId: profile.driver?.id || profile.id,
      });
    } catch (err: any) {
      console.warn('[Auth] Session check failed:', err.message);
      // Only clear the token if it hasn't changed since we started the check.
      // This prevents a race condition where login() stores a fresh token while
      // this stale check is still in-flight — the returning 401 would otherwise
      // wipe the brand-new token.
      const currentToken = await getToken();
      if (!currentToken) {
        // Already cleared (e.g. by apiFetch's 401 handler) — nothing to do
      }
      setState((prev) => {
        // Don't overwrite if login() already set isLoggedIn: true
        if (prev.isLoggedIn) return prev;
        return { isLoading: false, isLoggedIn: false, driverName: null, driverId: null };
      });
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
        console.log(`[Auth] Login OK. Token starts: ${res.token.slice(0, 20)}...`);
        await setToken(res.token);
        // Verify the write
        const verify = await getToken();
        console.log(`[Auth] Token stored. Re-read starts: ${verify ? verify.slice(0, 20) + '...' : 'NULL!'}`);
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
