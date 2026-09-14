import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useConversationStore, useSettingsStore } from './stores';
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

function MainLayout() {
  const { preferences, setPreferences, models, ollamaHealthy, setModels, setOllamaHealthy } = useSettingsStore();
  const { conversations, setConversations, setPinnedConversations } = useConversationStore();
  const { isAuthenticated } = useAuth();

  // Load settings and conversations on auth
  useEffect(() => {
    if (isAuthenticated) {
      const loadData = async () => {
        try {
          const [prefsRes, convRes, modelsRes, healthRes] = await Promise.allSettled([
            api.settings.get(),
            api.conversations.list({ page: 1, pageSize: 50 }),
            api.ai.models(),
            api.ai.health(),
          ]);

          if (prefsRes.status === 'fulfilled') {
            setPreferences(prefsRes.value.preferences);
          }
          if (convRes.status === 'fulfilled') {
            setConversations(convRes.value.data);
            setPinnedConversations(convRes.value.data.filter(c => c.pinned));
          }
          if (modelsRes.status === 'fulfilled') {
            setModels(modelsRes.value.models);
          }
          if (healthRes.status === 'fulfilled') {
            setOllamaHealthy(healthRes.value.reachable);
          }
        } catch (error) {
          console.error('Failed to load initial data:', error);
        }
      };
      loadData();
    }
  }, [isAuthenticated, setPreferences, setConversations, setPinnedConversations, setModels, setOllamaHealthy]);

  return (
    <div className="flex h-screen bg-background-primary dark:bg-background-primary">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0">
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
        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default App;