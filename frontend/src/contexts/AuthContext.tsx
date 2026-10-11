import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores';
import { api, setUnauthorizedHandler, ApiError } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, setAuth, clearAuth, setLoading, updateUser } = useAuthStore();

  // Session restoration relies on the HttpOnly cookie: ask the server who we
  // are on every load. A cached display profile is only used to ride out
  // transient network failures, never to authorize anything.
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const response = await api.auth.me();
        if (!cancelled) setAuth(response.user);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.statusCode === 401) {
          clearAuth();
        } else if (useAuthStore.getState().user) {
          // Backend unreachable: keep the cached profile; protected requests
          // will surface errors and a later 401 clears state automatically.
          setLoading(false);
        } else {
          clearAuth();
        }
      }
    };

    void initAuth();
    return () => {
      cancelled = true;
    };
  }, [setAuth, clearAuth, setLoading]);

  // Any 401 from any request clears stale client auth state once.
  useEffect(() => {
    setUnauthorizedHandler(() => useAuthStore.getState().clearAuth());
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.auth.login({ email, password });
    setAuth(response.user);
  }, [setAuth]);

  const signup = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    const response = await api.auth.signup({ name, email, password, confirmPassword });
    setAuth(response.user);
  }, [setAuth]);

  const logout = useCallback(async () => {
    // The server may already have invalidated this session; local state is
    // cleared regardless so the user never gets stuck.
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    clearAuth();
  }, [clearAuth]);

  const logoutAll = useCallback(async () => {
    try {
      await api.auth.logoutAll();
    } catch {
      // ignore
    }
    clearAuth();
  }, [clearAuth]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    await api.auth.changePassword({ currentPassword, newPassword, confirmPassword });
    // All sessions were invalidated server-side; drop local state too.
    clearAuth();
  }, [clearAuth]);

  const updateProfile = useCallback(async (data: { name?: string; email?: string }) => {
    const response = await api.auth.updateProfile(data);
    updateUser(response.user);
  }, [updateUser]);

  const deleteAccount = useCallback(async (password: string) => {
    await api.auth.deleteAccount(password);
    clearAuth();
  }, [clearAuth]);

  const refreshUser = useCallback(async () => {
    const response = await api.auth.me();
    updateUser(response.user);
  }, [updateUser]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      signup,
      logout,
      logoutAll,
      changePassword,
      updateProfile,
      deleteAccount,
      refreshUser,
    }),
    [user, isAuthenticated, isLoading, login, signup, logout, logoutAll, changePassword, updateProfile, deleteAccount, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
