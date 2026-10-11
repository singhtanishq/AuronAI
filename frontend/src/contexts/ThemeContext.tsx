import React, { createContext, useContext, useEffect, useCallback, useMemo, useState } from 'react';import { useUIStore, useSettingsStore } from '../stores';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import type { UserPreferences } from '../types';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * The UI store is the single source of truth for the theme. Server-side
 * preferences are mirrored here: local changes persist to the server when a
 * user is signed in, and a loaded preference updates the local value.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const setThemeStore = useUIStore((s) => s.setTheme);
  const preferences = useSettingsStore((s) => s.preferences);
  const setPreferences = useSettingsStore((s) => s.setPreferences);
  const { isAuthenticated } = useAuth();
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Adopt the server-side theme when preferences load for a signed-in user.
  useEffect(() => {
    if (preferences && preferences.theme !== theme) {
      setThemeStore(preferences.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.theme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeStore(newTheme);
      if (isAuthenticated) {
        // Persist in the background; the local value is already applied.
        api.settings.update({ theme: newTheme }).then((response) => {
          useSettingsStore.getState().setPreferences(response.preferences);
        }).catch(() => {
          // Offline: local theme still applies; server syncs on next change.
        });
      }
    },
    [setThemeStore, isAuthenticated]
  );

  const toggleTheme = useCallback(() => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
    setTheme(themes[nextIndex]);
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/** Persist arbitrary preference fields; used by settings surfaces. */
export function usePreferences() {
  const preferences = useSettingsStore((s) => s.preferences);
  const setPreferences = useSettingsStore((s) => s.setPreferences);

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      const previous = useSettingsStore.getState().preferences;
      // Optimistic local update; reconciled with the server response.
      if (previous) {
        setPreferences({ ...previous, [key]: value });
      }
      try {
        const response = await api.settings.update({ [key]: value });
        setPreferences(response.preferences);
      } catch (error) {
        if (previous) setPreferences(previous);
        throw error;
      }
    },
    [setPreferences]
  );

  return { preferences, updatePreference };
}
