import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores';
import { api } from '../services/api';
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

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.auth.me();
      updateUser(response.user);
    } catch {
      clearAuth();
    }
  }, [updateUser, clearAuth]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auron-auth') ? JSON.parse(localStorage.getItem('auron-auth')!).token : null;
      if (token) {
        try {
          const response = await api.auth.me();
          setAuth(response.user, token);
        } catch {
          clearAuth();
        }
      } else {
        setLoading(false);
      }
    };
    initAuth();
  }, [setAuth, clearAuth, setLoading]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.auth.login({ email, password });
    setAuth(response.user, response.token);
  }, [setAuth]);

  const signup = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    const response = await api.auth.signup({ name, email, password, confirmPassword });
    setAuth(response.user, response.token);
  }, [setAuth]);

  const logout = useCallback(async () => {
    await api.auth.logout();
    clearAuth();
  }, [clearAuth]);

  const logoutAll = useCallback(async () => {
    await api.auth.logoutAll();
    clearAuth();
  }, [clearAuth]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    await api.auth.changePassword({ currentPassword, newPassword, confirmPassword });
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

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}