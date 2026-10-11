import React, { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  User as UserIcon,
  Mail,
  Lock,
  AlertCircle,
  Check,
  MonitorSmartphone,
  Trash2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Avatar, Button, Input, ConfirmDialog } from '../components/ui';
import { api } from '../services/api';
import { formatDate, formatRelativeTime, parseApiDate } from '../utils/format';
import type { SessionInfo } from '../types';

type TabId = 'profile' | 'password' | 'sessions' | 'danger';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'profile', label: 'Personal info' },
  { id: 'password', label: 'Password' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'danger', label: 'Danger zone' },
];

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-line-subtle px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight text-content-primary">Profile</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav className="shrink-0 border-b border-line-subtle bg-surface-secondary/40 p-2 sm:w-52 sm:border-b-0 sm:border-r" aria-label="Profile sections">
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
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary',
                  tab.id === 'danger' && activeTab !== tab.id ? 'text-danger/80' : ''
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            {activeTab === 'profile' && <PersonalInfoSection />}
            {activeTab === 'password' && <PasswordSection />}
            {activeTab === 'sessions' && <SessionsSection />}
            {activeTab === 'danger' && <DangerZoneSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

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

/* ------------------------------ personal info ------------------------------ */

function PersonalInfoSection() {
  const { user, updateProfile } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (user) {
      setName((current) => (current === '' ? user.name : current));
      setEmail((current) => (current === '' ? user.email : current));
    }
  }, [user]);

  const dirty = user ? name.trim() !== user.name || email.trim().toLowerCase() !== user.email.toLowerCase() : false;

  const handleSave = async () => {
    setError('');
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      // One request updates both fields; the backend applies them together.
      await updateProfile({ name: name.trim(), email: email.trim() });
      addToast('Profile updated', 'success');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Section title="Personal information" description="Your name and email identify you on this device.">
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="xl" color={user.avatarColor} />
          <div>
            <p className="font-medium text-content-primary">{user.name}</p>
            <p className="text-sm text-content-muted">{user.email}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-subtle p-3 text-sm text-danger" role="alert">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} icon={<UserIcon size={16} />} maxLength={100} disabled={saving} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={16} />} disabled={saving} />

        <div className="flex items-center justify-end gap-2.5 border-t border-line-subtle pt-4">
          <Button variant="secondary" onClick={() => { setName(user.name); setEmail(user.email); setError(''); }} disabled={!dirty || saving}>
            Reset
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving} disabled={!dirty}>
            {savedFlash ? <Check size={16} /> : null}
            Save changes
          </Button>
        </div>

        <p className="text-xs text-content-muted">Member since {formatDate(user.createdAt)}</p>
      </div>
    </Section>
  );
}

/* -------------------------------- password -------------------------------- */

function PasswordSection() {
  const { changePassword } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      // Invalidates every session; the auth context clears local state.
      await changePassword(currentPassword, newPassword, confirmPassword);
      addToast('Password changed. Please sign in again.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
      setSaving(false);
    }
  };

  return (
    <Section title="Change password" description="Changing your password signs you out on all devices.">
      <form onSubmit={handleSubmit} className="card max-w-md space-y-4 p-5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-subtle p-3 text-sm text-danger" role="alert">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Input
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          icon={<Lock size={16} />}
          showPasswordToggle
          autoComplete="current-password"
          required
          disabled={saving}
        />
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          icon={<Lock size={16} />}
          showPasswordToggle
          autoComplete="new-password"
          required
          disabled={saving}
          hint="At least 8 characters."
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={<Lock size={16} />}
          showPasswordToggle
          autoComplete="new-password"
          required
          disabled={saving}
          error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
        />
        <div className="flex justify-end border-t border-line-subtle pt-4">
          <Button type="submit" variant="primary" loading={saving} disabled={!currentPassword || !newPassword}>
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* -------------------------------- sessions -------------------------------- */

function SessionsSection() {
  const { logoutAll } = useAuth();
  const { addToast } = useToast();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.auth.listSessions();
      setSessions(response.sessions);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api.auth.revokeSession(id);
      setSessions((current) => (current ? current.filter((s) => s.id !== id) : current));
      addToast('Session revoked', 'success');
    } catch {
      addToast('Failed to revoke session', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Section title="Active sessions" description="Every signed-in device. Revoke any session you don't recognize.">
      {loadError ? (
        <div className="flex items-center justify-between rounded-lg border border-danger/25 bg-danger-subtle p-3.5 text-sm text-danger">
          <span>Could not load sessions.</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
        </div>
      ) : sessions === null ? (
        <div className="card h-16 animate-pulse bg-surface-secondary" />
      ) : (
        <div className="space-y-2.5">
          {sessions.map((session) => (
            <div key={session.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                  <MonitorSmartphone size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-content-primary">
                    Signed in {formatRelativeTime(session.createdAt)}
                    {session.isCurrent && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ok-subtle px-2 py-0.5 text-[0.68rem] font-medium text-ok">
                        <ShieldCheck size={10} /> this device
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-content-muted">
                    Expires {parseApiDate(session.expiresAt)?.toLocaleDateString() ?? 'unknown'}
                  </p>
                </div>
              </div>
              {session.isCurrent ? (
                <Button variant="secondary" size="sm" icon={<LogOut size={14} />} onClick={() => void logoutAll()}>
                  Log out
                </Button>
              ) : (
                <Button variant="secondary" size="sm" loading={revokingId === session.id} onClick={() => void handleRevoke(session.id)}>
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-2">
        <Button variant="secondary" icon={<LogOut size={15} />} onClick={() => void logoutAll()}>
          Log out of all devices
        </Button>
        <p className="mt-2 text-xs text-content-muted">Ends every session, including this one.</p>
      </div>
    </Section>
  );
}

/* ------------------------------- danger zone ------------------------------- */

function DangerZoneSection() {
  const { user, deleteAccount } = useAuth();
  const { addToast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteAccount(password);
      addToast('Account deleted', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <Section title="Danger zone" description="This action is permanent.">
      <div className="rounded-lg border border-danger/30 bg-danger-subtle/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-content-primary">Delete this account</p>
            <p className="mt-0.5 text-xs text-content-muted">
              Removes {user.email} and all associated data from this machine.
            </p>
          </div>
          <Button
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={() => {
              setPassword('');
              setError('');
              setShowConfirm(true);
            }}
          >
            Delete account…
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => (deleting ? undefined : setShowConfirm(false))}
        onConfirm={() => void handleDelete()}
        title="Delete account?"
        description="Your account, conversations, messages, and preferences will be permanently removed from this device. Enter your password to confirm."
        confirmLabel="Delete account"
        danger
        loading={deleting}
        customInput={
          <div className="space-y-3">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              disabled={deleting}
              error={error || undefined}
            />
          </div>
        }
      />
    </Section>
  );
}
