import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Loader2, User, Mail, Lock, AlertCircle, CheckCircle, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Button, Input, Modal, Avatar } from '../components/ui';
import { api } from '../services/api';

export function ProfilePage() {
  const { user, updateProfile, changePassword, logout, logoutAll, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'sessions'>('profile');
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Errors
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleProfileSave = async () => {
    setProfileError('');
    setSaving(true);
    try {
      await updateProfile({ name, email });
      await refreshUser();
      addToast('Profile updated', 'success');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword, confirmNewPassword);
      addToast('Password changed. Please log in again.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      logout();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    addToast('Logged out from all devices', 'success');
  };

  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border-light dark:border-border-dark px-6 py-4">
        <h1 className="text-2xl font-bold text-text-primary">Profile</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar tabs */}
        <nav className="w-48 flex-shrink-0 border-r border-border-light dark:border-border-dark bg-background-primary/50 dark:bg-surface-900/50" aria-label="Profile categories">
          <ul className="p-3 space-y-1" role="tablist">
            {[
              { id: 'profile', label: 'Personal Info', icon: User },
              { id: 'password', label: 'Password', icon: Lock },
              { id: 'sessions', label: 'Sessions', icon: Camera },
            ].map((tab) => {
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
          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Personal Information</h2>
                <p className="text-sm text-text-muted">Update your name and email address</p>

                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={user.name} size="xl" />
                    <div>
                      <p className="font-medium text-text-primary">Current avatar</p>
                      <p className="text-sm text-text-muted">Generated from your name</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6 space-y-4">
                  {profileError && (
                    <div className="flex items-center gap-2 p-3 bg-error-light dark:bg-error-dark/20 rounded-lg text-sm text-error-dark dark:text-error-light" role="alert">
                      <AlertCircle size={16} />
                      <span>{profileError}</span>
                    </div>
                  )}

                  <Input
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    icon={<User size={18} />}
                    required
                    disabled={saving}
                  />

                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    icon={<Mail size={18} />}
                    required
                    disabled={saving}
                  />

                  <div className="flex justify-end pt-4 border-t border-border-light dark:border-border-dark">
                    <Button variant="primary" onClick={handleProfileSave} loading={saving}>
                      <CheckCircle size={18} />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                <h2 className="text-lg font-semibold text-text-primary">Account Info</h2>
                <div className="card p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-text-muted">User ID</p>
                      <p className="font-mono text-text-primary break-all">{user.id}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Created</p>
                      <p className="font-medium text-text-primary">{new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="max-w-md space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Change Password</h2>
                <p className="text-sm text-text-muted">Your password must be at least 8 characters</p>

                <div className="card p-6 space-y-4">
                  {passwordError && (
                    <div className="flex items-center gap-2 p-3 bg-error-light dark:bg-error-dark/20 rounded-lg text-sm text-error-dark dark:text-error-light" role="alert">
                      <AlertCircle size={16} />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <Input
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    icon={<Lock size={18} />}
                    showPasswordToggle
                    required
                    autoComplete="current-password"
                    disabled={saving}
                  />

                  <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    icon={<Lock size={18} />}
                    showPasswordToggle
                    required
                    autoComplete="new-password"
                    disabled={saving}
                    hint={
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center', newPassword.length >= 8 ? 'border-success-DEFAULT text-success-DEFAULT bg-success-light dark:bg-success-dark/20' : 'border-border-medium text-text-muted')}>
                            {newPassword.length >= 8 && <CheckCircle size={10} />}
                          </span>
                          <span className={clsx(newPassword.length >= 8 ? 'text-success-DEFAULT' : 'text-text-muted')}>At least 8 characters</span>
                        </div>
                      </div>
                    }
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    icon={<Lock size={18} />}
                    showPasswordToggle
                    required
                    autoComplete="new-password"
                    disabled={saving}
                    error={confirmNewPassword && newPassword !== confirmNewPassword ? 'Passwords do not match' : undefined}
                  />

                  <div className="flex justify-end pt-4 border-t border-border-light dark:border-border-dark">
                    <Button variant="primary" onClick={handlePasswordChange} loading={saving}>
                      <CheckCircle size={18} />
                      Change Password
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="max-w-2xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">Active Sessions</h2>
                <p className="text-sm text-text-muted">Manage your active login sessions</p>

                <div className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <Camera size={20} className="text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Current Session</p>
                        <p className="text-sm text-text-muted">This device • Active now</p>
                      </div>
                    </div>
                    <span className="badge badge-success">Current</span>
                  </div>
                </div>

                <div className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                        <Camera size={20} className="text-text-muted" />
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Other Sessions</p>
                        <p className="text-sm text-text-muted">No other active sessions</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-light dark:border-border-dark">
                  <Button variant="secondary" onClick={handleLogoutAll} icon={<Loader2 size={18} />}>
                    Log Out of All Sessions
                  </Button>
                  <p className="mt-2 text-sm text-text-muted">
                    This will log you out from all devices including this one.
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}