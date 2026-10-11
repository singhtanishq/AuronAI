import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Mail, Lock, User as UserIcon, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';
import { AppLogo } from '../components/AppLogo';

const MIN_PASSWORD_LENGTH = 8;

export function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Backend policy: 8+ characters. Advertised checks match exactly what the
  // server enforces — no suggested-but-unenforced requirements.
  const requirements = [
    { met: password.length >= MIN_PASSWORD_LENGTH, label: 'At least 8 characters' },
    { met: password.length > 0 && password === confirmPassword, label: 'Passwords match' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length === 0) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await signup(name.trim(), email, password, confirmPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background-primary p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block" aria-label="Auron AI home">
            <AppLogo size="lg" />
          </Link>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-content-primary">Create your account</h1>
          <p className="mt-1.5 text-sm text-content-secondary">Everything stays on this machine</p>
        </div>

        <div className="card p-6 shadow-md">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-subtle p-3 text-sm text-danger" role="alert">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              icon={<UserIcon size={17} />}
              required
              autoComplete="name"
              autoFocus
              disabled={isLoading}
              maxLength={100}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail size={17} />}
              required
              autoComplete="email"
              disabled={isLoading}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock size={17} />}
              showPasswordToggle
              required
              autoComplete="new-password"
              disabled={isLoading}
              hint={
                <div className="mt-1 space-y-1">
                  {requirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-1.5 text-xs">
                      <span
                        className={clsx(
                          'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                          req.met ? 'border-ok bg-ok-subtle text-ok' : 'border-line-default text-content-muted'
                        )}
                      >
                        {req.met && <Check size={9} strokeWidth={3.5} />}
                      </span>
                      <span className={clsx(req.met ? 'text-ok' : 'text-content-muted')}>{req.label}</span>
                    </div>
                  ))}
                </div>
              }
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock size={17} />}
              showPasswordToggle
              required
              autoComplete="new-password"
              disabled={isLoading}
              error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
            />
            <Button type="submit" variant="primary" fullWidth loading={isLoading}>
              Create account
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-content-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-accent transition-colors hover:text-accent-hover">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-content-muted">
          Local-first · your conversations never leave this device
        </p>
      </div>
    </div>
  );
}
