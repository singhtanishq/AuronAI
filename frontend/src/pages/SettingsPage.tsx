import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Save, Loader2, Cpu, Palette, Sidebar, Keyboard, Eye, Globe, Database, Zap } from 'lucide-react';
import { useSettingsStore } from '../../stores';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../ui/Toast';
import { Button, Input, Modal } from '../ui';
import { api } from '../../services/api';
import type { UserPreferences } from '../../types';

export function SettingsPage() {
  const { preferences, setPreferences, models, ollamaHealthy, isLoading, setLoading } = useSettingsStore();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'appearance' | 'chat' | 'ai' | 'privacy' | 'account'>('appearance');
  const [saving, setSaving] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<UserPreferences | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState('');

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const handleSave = async () => {
    if (!localPrefs) return;
    setSaving(true);
    try {
      await api.settings.update(localPrefs);
      setPreferences(localPrefs);
      addToast('Settings saved', 'success');
    } catch {
      addToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteAllConfirm !== 'DELETE ALL') return;
    try {
      await api.conversations.deleteAll();
      addToast('All conversations deleted', 'success');
      setShowDeleteAllModal(false);
      setDeleteAllConfirm('');
    } catch {
      addToast('Failed to delete conversations', 'error');
    }
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'chat', label: 'Chat', icon: Keyboard },
    { id: 'ai', label: 'AI Model', icon: Cpu },
    { id: 'privacy', label: 'Privacy', icon: Eye },
    { id: 'account', label: 'Account', icon: User },
  ];

  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border-light dark:border-border-dark px-6 py-4">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar tabs */}
        <nav className="w-48 flex-shrink-0 border-r border-border-light dark:border-border-dark bg-background-primary/50 dark:bg-surface-900/50" aria-label="Settings categories">
          <ul className="p-3 space-y-1" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.id} role="presentation">
                  <button
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-100 dark:hover:bg-surface-800'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'appearance' && (
            <div className="max-w-2xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Theme</h2>
                <p className="text-sm text-text-muted">Choose your preferred color scheme</p>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t);
                        setLocalPrefs(p => p ? { ...p, theme: t } : null);
                      }}
                      className={clsx(
                        'p-4 rounded-lg border-2 transition-all duration-150 flex flex-col items-center gap-2',
                        theme === t
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-border-medium hover:border-border-dark dark:hover:border-border-light'
                      )}
                    >
                      <span className={clsx('text-lg font-medium', theme === t ? 'text-primary-600 dark:text-primary-400' : 'text-text-primary')}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                <h2 className="text-lg font-semibold text-text-primary">Sidebar</h2>
                <p className="text-sm text-text-muted">Configure sidebar behavior</p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">Collapsed by default</p>
                      <p className="text-sm text-text-muted">Start with sidebar collapsed</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={localPrefs?.sidebarCollapsed || false}
                      onChange={(e) => setLocalPrefs(p => p ? { ...p, sidebarCollapsed: e.target.checked } : null)}
                      className="w-5 h-5 rounded border-border-medium text-primary-600 focus:ring-primary-500"
                    />
                  </label>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="max-w-2xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Message Input</h2>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">Enter to send</p>
                      <p className="text-sm text-text-muted">Press Enter to send, Shift+Enter for new line</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={localPrefs?.enterToSend ?? true}
                      onChange={(e) => setLocalPrefs(p => p ? { ...p, enterToSend: e.target.checked } : null)}
                      className="w-5 h-5 rounded border-border-medium text-primary-600 focus:ring-primary-500"
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                <h2 className="text-lg font-semibold text-text-primary">Display</h2>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">Show timestamps</p>
                      <p className="text-sm text-text-muted">Display message timestamps</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={localPrefs?.showTimestamps ?? true}
                      onChange={(e) => setLocalPrefs(p => p ? { ...p, showTimestamps: e.target.checked } : null)}
                      className="w-5 h-5 rounded border-border-medium text-primary-600 focus:ring-primary-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">Auto-scroll</p>
                      <p className="text-sm text-text-muted">Automatically scroll to new messages</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={localPrefs?.autoScroll ?? true}
                      onChange={(e) => setLocalPrefs(p => p ? { ...p, autoScroll: e.target.checked } : null)}
                      className="w-5 h-5 rounded border-border-medium text-primary-600 focus:ring-primary-500"
                    />
                  </label>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="max-w-2xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Model Selection</h2>
                <p className="text-sm text-text-muted">Choose which local model to use for chat</p>
                <div className="space-y-3">
                  <select
                    value={localPrefs?.model || ''}
                    onChange={(e) => setLocalPrefs(p => p ? { ...p, model: e.target.value } : null)}
                    className="input"
                    disabled={!ollamaHealthy || isLoading}
                  >
                    {models.length === 0 ? (
                      <option value="">No models available</option>
                    ) : (
                      models.map((model) => (
                        <option key={model.name} value={model.name}>
                          {model.name} ({(model.size / 1e9).toFixed(1)}B)
                        </option>
                      ))
                    )}
                  </select>
                  {!ollamaHealthy && (
                    <p className="text-sm text-warning-DEFAULT flex items-center gap-1">
                      <Zap size={14} /> Ollama not connected. Start Ollama to see available models.
                    </p>
                  )}
                  {isLoading && (
                    <p className="text-sm text-text-muted flex items-center gap-1">
                      <Loader2 size={14} className="animate-spin" /> Loading models...
                    </p>
                  )}
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                <h2 className="text-lg font-semibold text-text-primary">Temperature</h2>
                <p className="text-sm text-text-muted">Controls randomness in responses. Lower = more focused, Higher = more creative</p>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localPrefs?.temperature ?? 0.7}
                    onChange={(e) => setLocalPrefs(p => p ? { ...p, temperature: parseFloat(e.target.value) } : null)}
                    className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none accent-primary-600"
                  />
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Focused (0)</span>
                    <span className="font-medium">{localPrefs?.temperature ?? 0.7}</span>
                    <span>Creative (2)</span>
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                <h2 className="text-lg font-semibold text-text-primary">System Prompt</h2>
                <p className="text-sm text-text-muted">Customize the AI's behavior and personality</p>
                <textarea
                  value={localPrefs?.systemPrompt || ''}
                  onChange={(e) => setLocalPrefs(p => p ? { ...p, systemPrompt: e.target.value } : null)}
                  rows={6}
                  className="input min-h-[120px] font-mono text-sm resize-y"
                  placeholder="Add custom instructions for the AI..."
                />
              </section>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="max-w-2xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Data & Privacy</h2>
                <div className="card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-text-primary">Local-first architecture</h3>
                      <p className="text-sm text-text-muted mt-1">
                        All conversations are stored locally in a SQLite database on your machine.
                        No data is sent to external servers.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Cpu className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-text-primary">Local AI inference</h3>
                      <p className="text-sm text-text-muted mt-1">
                        AI models run locally through Ollama. No API keys or cloud inference required.
                        Your prompts never leave your device.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-text-primary">Offline capable</h3>
                      <p className="text-sm text-text-muted mt-1">
                        Once models are downloaded, Auron AI works completely offline.
                        No internet connection required for chat.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                <h2 className="text-lg font-semibold text-text-primary">Danger Zone</h2>
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteAllModal(true)}
                  icon={<Database size={18} />}
                >
                  Delete All Conversations
                </Button>
                <p className="text-sm text-text-muted">
                  This will permanently delete all your conversation history. This action cannot be undone.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="max-w-2xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Account Information</h2>
                <div className="card p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-2xl font-bold text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{user.name}</p>
                      <p className="text-sm text-text-muted">{user.email}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border-light dark:border-border-dark">
                    <p className="text-sm text-text-muted">
                      Member since {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                <h2 className="text-lg font-semibold text-text-primary">Danger Zone</h2>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      // Handle account deletion
                    }
                  }}
                  icon={<Database size={18} />}
                >
                  Delete Account
                </Button>
                <p className="text-sm text-text-muted">
                  Permanently delete your account and all associated data.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Save bar */}
      {localPrefs && (
        <div className="border-t border-border-light dark:border-border-dark px-6 py-4 bg-background-primary/50 dark:bg-surface-900/50">
          <div className="max-w-2xl mx-auto flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setLocalPrefs(preferences)}>
              Reset
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              <Save size={18} />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      <Modal
        isOpen={showDeleteAllModal}
        onClose={() => { setShowDeleteAllModal(false); setDeleteAllConfirm(''); }}
        title="Delete All Conversations"
        description="This action cannot be undone. Please type 'DELETE ALL' to confirm."
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Confirmation"
            value={deleteAllConfirm}
            onChange={(e) => setDeleteAllConfirm(e.target.value)}
            placeholder="Type DELETE ALL to confirm"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowDeleteAllModal(false); setDeleteAllConfirm(''); }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAll} disabled={deleteAllConfirm !== 'DELETE ALL'}>
              Delete All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}