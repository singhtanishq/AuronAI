import React from 'react';
import { clsx } from 'clsx';
import { Sparkles, Code, Lightbulb, BookOpen, Mail, Calendar, Bot, Zap } from 'lucide-react';
import { Button } from '../ui';

const PROMPT_SUGGESTIONS = [
  {
    icon: Sparkles,
    title: 'Explain quantum computing simply',
    description: 'Get a clear explanation of complex topics',
    prompt: 'Explain quantum computing in simple terms',
  },
  {
    icon: Code,
    title: 'Help me write a React authentication flow',
    description: 'Get coding assistance and best practices',
    prompt: 'Help me write a React authentication flow with hooks',
  },
  {
    icon: Lightbulb,
    title: 'Brainstorm ideas for a side project',
    description: 'Creative brainstorming and ideation',
    prompt: 'Brainstorm 10 creative side project ideas for a developer',
  },
  {
    icon: BookOpen,
    title: 'Teach me JavaScript closures',
    description: 'Learn programming concepts step by step',
    prompt: 'Teach me JavaScript closures with practical examples',
  },
  {
    icon: Mail,
    title: 'Write a professional email',
    description: 'Draft emails, messages, and communications',
    prompt: 'Write a professional follow-up email after a job interview',
  },
  {
    icon: Calendar,
    title: 'Help me plan my week',
    description: 'Productivity planning and organization',
    prompt: 'Help me create a productive weekly schedule',
  },
];

export function Welcome({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <div className="max-w-2xl space-y-8">
        {/* Logo & Title */}
        <div className="space-y-4 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-600 mx-auto">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-text-primary tracking-tight">
              Welcome to Auron AI
            </h1>
            <p className="mt-2 text-lg text-text-secondary">
              Powered by Tanishq Singh
            </p>
          </div>
        </div>

        {/* Tagline */}
        <div className="animate-slide-up">
          <p className="text-xl text-text-tertiary max-w-md mx-auto">
            Ask me anything. I&apos;m your local AI assistant running entirely on your machine.
          </p>
        </div>

        {/* Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-slide-up">
          {PROMPT_SUGGESTIONS.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSelectPrompt(suggestion.prompt)}
              className={clsx(
                'relative p-4 text-left rounded-xl border border-border-light hover:border-primary-300 dark:hover:border-primary-700',
                'hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <suggestion.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-text-primary truncate">{suggestion.title}</h3>
                  <p className="mt-0.5 text-sm text-text-muted">{suggestion.description}</p>
                </div>
              </div>
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Zap className="w-4 h-4 text-primary-500" />
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="animate-fade-in pt-4 border-t border-border-light dark:border-border-dark">
          <p className="text-sm text-text-muted">
            Running locally via Ollama &middot; Your data stays on your device
          </p>
        </div>
      </div>
    </div>
  );
}