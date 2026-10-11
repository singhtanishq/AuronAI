import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';
import { AppLogo } from '../components/AppLogo';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-content-primary">Welcome back</h1>
          <p className="mt-1.5 text-sm text-content-secondary">Sign in to your local Auron AI workspace</p>
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
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail size={17} />}
              required
              autoComplete="email"
              autoFocus
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
              autoComplete="current-password"
              disabled={isLoading}
            />
            <Button type="submit" variant="primary" fullWidth loading={isLoading}>
              Sign in
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-content-muted">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-medium text-accent transition-colors hover:text-accent-hover">
              Create one
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
