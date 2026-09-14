import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';

export function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { met: password.length >= 8, label: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), label: 'One uppercase letter' },
    { met: /[a-z]/.test(password), label: 'One lowercase letter' },
    { met: /[0-9]/.test(password), label: 'One number' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await signup(name, email, password, confirmPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-primary dark:bg-background-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-text-primary">Create an account</h1>
          <p className="mt-2 text-text-muted">Start using Auron AI locally</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-error-light dark:bg-error-dark/20 rounded-lg text-sm text-error-dark dark:text-error-light" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              icon={<User size={18} />}
              required
              autoComplete="name"
              disabled={isLoading}
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail size={18} />}
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
              icon={<Lock size={18} />}
              showPasswordToggle
              required
              autoComplete="new-password"
              hint={
                <div className="space-y-1 mt-1">
                  {passwordRequirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center', req.met ? 'border-success-DEFAULT text-success-DEFAULT bg-success-light dark:bg-success-dark/20' : 'border-border-medium text-text-muted')}>
                        {req.met && <CheckCircle size={10} />}
                      </span>
                      <span className={clsx(req.met ? 'text-success-DEFAULT' : 'text-text-muted')}>{req.label}</span>
                    </div>
                  ))}
                </div>
              }
              disabled={isLoading}
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock size={18} />}
              showPasswordToggle
              required
              autoComplete="new-password"
              error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
              disabled={isLoading}
            />

            <Button type="submit" variant="primary" fullWidth loading={isLoading} className="mt-2">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          By creating an account, you agree to our local-first privacy policy.
          Your data never leaves your device.
        </p>

        <p className="mt-2 text-center text-sm text-text-muted">
          Powered by Tanishq Singh
        </p>
      </div>
    </div>
  );
}