import React, { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useSettingsStore } from './stores';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoadingScreen } from './components/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }
  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }
  return <>{children}</>;
}

/**
 * Authenticated shell: sidebar plus the routed content. Loads the user's
 * preferences and the Ollama model/health snapshot once per session.
 */
function MainLayout() {
  const { isAuthenticated } = useAuth();
  const loadedForUser = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      loadedForUser.current = false;
      return;
    }
    if (loadedForUser.current) return;
    loadedForUser.current = true;

    void (async () => {
      const [prefsRes, modelsRes, healthRes] = await Promise.allSettled([
        api.settings.get(),
        api.ai.models(),
        api.ai.health(),
      ]);

      const settingsStore = useSettingsStore.getState();
      if (prefsRes.status === 'fulfilled') {
        settingsStore.setPreferences(prefsRes.value.preferences);
      }
      if (healthRes.status === 'fulfilled') {
        settingsStore.setOllamaHealthy(healthRes.value.ai.reachable);
      }
      if (modelsRes.status === 'fulfilled') {
        settingsStore.setModels(modelsRes.value.models);
      }
    })();
  }, [isAuthenticated]);

  return (
    <div className="flex h-full overflow-hidden bg-background-primary">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/chat" element={<ChatArea />} />
        <Route path="/chat/:conversationId" element={<ChatArea />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default App;
