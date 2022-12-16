import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Cpu, Monitor, Moon, Sun, Database, ShieldCheck, Wifi, AlertCircle, Check } from 'lucide-react';
import { useSettingsStore } from '../stores';
import { useTheme, usePreferences } from '../contexts/ThemeContext';
import { useToast } from '../components/ui/Toast';
import { Button, Input, Textarea, ConfirmDialog, Modal } from '../components/ui';
import { api } from '../services/api';
import { formatModelSize } from '../utils/format';
import type { Theme } from '../types';

type TabId = 'appearance' | 'chat' | 'model' | 'data';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'chat', label: 'Chat' },
  { id: 'model', label: 'AI Model' },
  { id: 'data', label: 'Data & Privacy' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('appearance');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-line-subtle px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight text-content-primary">Settings</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav className="shrink-0 border-b border-line-subtle bg-surface-secondary/40 p-2 sm:w-52 sm:border-b-0 sm:border-r" aria-label="Settings sections">
          <div role="tablist" className="flex gap-1 sm:flex-col">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex-1 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-fast sm:flex-none',
                  activeTab === tab.id
                    ? 'bg-accent-subtle text-content-primary'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            {activeTab === 'appearance' && <AppearanceSection />}
            {activeTab === 'chat' && <ChatSection />}
            {activeTab === 'model' && <ModelSection />}
            {activeTab === 'data' && <DataSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ shared pieces ------------------------------ */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pb-8">
      <div>
        <h2 className="text-base font-semibold text-content-primary">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-content-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line-subtle bg-surface-primary p-4 transition-colors hover:bg-surface-hover/60">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-content-primary">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-content-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-fast',
          checked ? 'bg-accent-solid' : 'bg-line-default',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-fast ease-out',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  );
}

/* ------------------------------- appearance ------------------------------- */

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'Light', icon: <Sun size={18} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={18} /> },
  { value: 'system', label: 'System', icon: <Monitor size={18} /> },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreference } = usePreferences();
  const { addToast } = useToast();

  const handleSetTheme = (value: Theme) => {
    setTheme(value); // theme persists on its own via ThemeContext
  };

  return (
    <>
      <Section title="Theme" description="Choose how Auron AI looks. System follows your OS setting.">
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => handleSetTheme(option.value)}
              className={clsx(
                'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-fast ease-out',
                theme === option.value
                  ? 'border-accent bg-accent-subtle/50 text-content-primary'
                  : 'border-line-subtle bg-surface-primary text-content-secondary hover:border-line-default hover:bg-surface-hover'
              )}
            >
              <span className={theme === option.value ? 'text-accent' : 'text-content-muted'}>{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sidebar" description="Applies to this device and syncs to your account.">
        <ToggleRow
          label="Collapsed by default"
          description="Start with the sidebar collapsed on wide screens"
          checked={preferences?.sidebarCollapsed ?? false}
          onChange={(value) => {
            useUIStoreSetSidebar(value);
            void updatePreference('sidebarCollapsed', value).catch(() => {
              addToast('Could not save the sidebar preference', 'error');
            });
          }}
        />
      </Section>
    </>
  );
}

function useUIStoreSetSidebar(): (v: boolean) => void {
  return (v: boolean) => import('../stores').then(({ useUIStore }) => useUIStore.getState().setSidebarCollapsed(v));
}

/* ---------------------------------- chat ---------------------------------- */

function ChatSection() {
  const { preferences, updatePreference } = usePreferences();
  const { addToast } = useToast();

  const update = (key: 'enterToSend' | 'showTimestamps' | 'autoScroll', value: boolean) => {
    void updatePreference(key, value).catch(() => {
      addToast('Could not save the preference', 'error');
    });
  };

  return (
    <>
      <Section title="Composing" description="How the message input behaves.">
        <div className="space-y-3">
          <ToggleRow
            label="Enter to send"
            description="When off, press Ctrl+Enter to send and Enter inserts a new line"
            checked={preferences?.enterToSend ?? true}
            onChange={(value) => update('enterToSend', value)}
          />
        </div>
      </Section>
      <Section title="Reading" description="How messages appear while you chat.">
        <div className="space-y-3">
          <ToggleRow
            label="Show timestamps"
            description="Display the time next to each message"
            checked={preferences?.showTimestamps ?? true}
            onChange={(value) => update('showTimestamps', value)}
          />
          <ToggleRow
            label="Auto-scroll"
            description="Follow new responses while you are at the bottom of the conversation"
            checked={preferences?.autoScroll ?? true}
            onChange={(value) => update('autoScroll', value)}
          />
        </div>
      </Section>
    </>
  );
}

/* ---------------------------------- model ---------------------------------- */

function ModelSection() {
  const { preferences, updatePreference } = usePreferences();
  const { models, modelsLoaded, ollamaHealthy } = useSettingsStore();
  const { addToast } = useToast();
  const [temperature, setTemperature] = useState<number>(preferences?.temperature ?? 0.7);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (preferences?.temperature !== undefined) setTemperature(preferences.temperature);
  }, [preferences?.temperature]);

  const handleTemperature = (value: number) => {
    setTemperature(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void updatePreference('temperature', value).catch(() => addToast('Could not save the temperature', 'error'));
    }, 350);
  };

  const effectiveModel = preferences?.model;

  return (
    <>
      <Section title="Model" description="Which local Ollama model responses are generated with.">
        {!ollamaHealthy ? (
          <div className="flex items-center gap-2 rounded-lg border border-warn/25 bg-warn-subtle p-3.5 text-sm text-warn">
            <AlertCircle size={15} className="shrink-0" />
            Ollama is not reachable. Start it with <code className="font-mono">ollama serve</code> to pick a model.
          </div>
        ) : (
          <select
            value={effectiveModel || ''}
            onChange={(e) => {
              void updatePreference('model', e.target.value).catch(() => addToast('Could not save the model', 'error'));
            }}
            aria-label="Model"
            className="w-full rounded-lg border border-line-subtle bg-surface-primary px-3 py-2.5 text-sm text-content-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/60"
          >
            {models.length === 0 ? (
              <option value="">{modelsLoaded ? 'No models installed — run `ollama pull <model>`' : 'Loading models…'}</option>
            ) : (
              models.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name} · {formatModelSize(model.size)}
                </option>
              ))
            )}
          </select>
        )}
        {ollamaHealthy && effectiveModel && models.length > 0 && !models.some((m) => m.name === effectiveModel) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
            <AlertCircle size={12} /> “{effectiveModel}” is not installed; chat will fall back to {models[0].name}.
          </p>
        )}
      </Section>

      <Section title="Temperature" description="Lower values are focused and deterministic; higher values are more creative.">
        <div className="rounded-lg border border-line-subtle bg-surface-primary p-4">
          <div className="mb-2 flex items-center justify-between">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => handleTemperature(parseFloat(e.target.value))}
              aria-label="Temperature"
              className="h-2 w-[calc(100%-5.5rem)] cursor-pointer appearance-none rounded-lg bg-surface-secondary accent-[rgb(var(--accent))] outline-offset-4"
            />
            <span className="w-12 rounded-md bg-surface-secondary py-1 text-center font-mono text-sm text-content-primary">
              {temperature.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-content-muted">
            <span>Precise (0)</span>
            <span>Balanced (1)</span>
            <span>Creative (2)</span>
          </div>
        </div>
      </Section>

      <Section title="System prompt" description="Additional instructions appended to Auron's core personality.">
        <SystemPromptField />
      </Section>
    </>
  );
}

function SystemPromptField() {
  const { preferences, updatePreference } = usePreferences();
  const { addToast } = useToast();
  const [value, setValue] = useState(preferences?.systemPrompt ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (preferences) setValue(preferences.systemPrompt);
  }, [preferences?.systemPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void updatePreference('systemPrompt', next).catch(() => addToast('Could not save the system prompt', 'error'));
    }, 500);
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        rows={5}
        maxHeight={220}
        maxLength={5000}
        placeholder="Add custom instructions for the AI…"
        aria-label="System prompt"
      />
      <div className="flex items-center justify-between text-xs text-content-muted">
        <span>Applies to new messages in every conversation.</span>
        <span>{value.length.toLocaleString()} / 5,000</span>
      </div>
    </div>
  );
}

/* ---------------------------------- data ---------------------------------- */

function DataSection() {
  const { addToast } = useToast();
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const response = await api.conversations.deleteAll();
      useConversationStoreReset();
      addToast(`Deleted ${response.count} conversation${response.count === 1 ? '' : 's'}`, 'success');
      setShowDeleteAll(false);
    } catch {
      addToast('Failed to delete conversations', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Section title="Local-first by design" description="How Auron AI handles your data.">
        <div className="card divide-y divide-line-subtle overflow-hidden">
          <DataFact icon={<Database size={17} />} title="Stored on this machine" body="Conversations live in a local SQLite database inside the backend's data directory." />
          <DataFact icon={<Cpu size={17} />} title="Local inference" body="Responses are generated by Ollama on your hardware. No cloud calls, no API keys." />
          <DataFact icon={<Wifi size={17} />} title="No telemetry" body="Auron AI makes no analytics or third-party requests." />
          <DataFact icon={<ShieldCheck size={17} />} title="You control deletion" body="Delete individual conversations or everything at any time below." />
        </div>
      </Section>

      <Section title="Danger zone" description="These actions cannot be undone.">
        <div className="rounded-lg border border-danger/30 bg-danger-subtle/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-content-primary">Delete all conversations</p>
              <p className="mt-0.5 text-xs text-content-muted">Removes every conversation and message for your account.</p>
            </div>
            <Button variant="danger" onClick={() => setShowDeleteAll(true)}>
              Delete all…
            </Button>
          </div>
        </div>
      </Section>

      <ConfirmDialog
        isOpen={showDeleteAll}
        onClose={() => setShowDeleteAll(false)}
        onConfirm={() => void handleDeleteAll()}
        title="Delete all conversations?"
        description="Every conversation and message on this account will be permanently deleted."
        confirmLabel="Delete everything"
        danger
        requireText="DELETE ALL"
        loading={isDeleting}
      />
    </>
  );
}

function DataFact({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">{icon}</span>
      <div>
        <p className="text-sm font-medium text-content-primary">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-content-muted">{body}</p>
      </div>
    </div>
  );
}

async function useConversationStoreReset(): Promise<void> {
  const { useConversationStore, useChatStore } = await import('../stores');
  useConversationStore.getState().setConversations([]);
  useConversationStore.getState().clearActiveConversation();
  useChatStore.getState().endGeneration('');
}

async function useUIStoreSetSidebarWrapper(): Promise<void> {
  const { useUIStore } = await import('../stores');
  useUIStore.getState().toggleSidebar();
}

function useUIStoreSetSidebarFn(): (value: boolean) => void {
  return (value: boolean) => {
    void useUIStoreSetSidebarWrapper;
    void value;
  };
}

const useUIStoreSetSidebar = function (value: boolean): void {
  void import('../stores').then(({ useUIStore }) => useUIStore.getState().setSidebarCollapsed(value));
  void useUIStoreSetSidebarFn;
};

export { Check };
