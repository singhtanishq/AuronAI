import { Cpu, MessageSquare, Sparkles, Code2, Lightbulb, BookOpen, PenLine, CalendarClock } from 'lucide-react';
import { clsx } from 'clsx';
import { useSettingsStore } from '../stores';

const PROMPT_SUGGESTIONS = [
  { icon: Sparkles, title: 'Explain a complex topic', prompt: 'Explain quantum computing in simple terms' },
  { icon: Code2, title: 'Write some code', prompt: 'Write a TypeScript debounce function with tests' },
  { icon: Lightbulb, title: 'Brainstorm ideas', prompt: 'Brainstorm 10 creative side project ideas for a developer' },
  { icon: BookOpen, title: 'Learn something', prompt: 'Teach me JavaScript closures with practical examples' },
  { icon: PenLine, title: 'Draft a message', prompt: 'Write a professional follow-up email after a job interview' },
  { icon: CalendarClock, title: 'Make a plan', prompt: 'Help me create a productive weekly schedule' },
];

interface WelcomeProps {
  onSelectPrompt: (prompt: string) => void;
  compact?: boolean;
}

export function Welcome({ onSelectPrompt, compact = false }: WelcomeProps) {
  const ollamaHealthy = useSettingsStore((s) => s.ollamaHealthy);

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className={clsx('space-y-4', compact ? 'pt-6' : 'pt-10')}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-solid shadow-lg shadow-accent/20">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.514 15.782 3 14.128 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-content-primary">
              {compact ? 'How can I help?' : 'Welcome to Auron AI'}
            </h1>
            <p className="mt-2 text-base text-content-secondary">
              Your local AI assistant — private, offline-capable, and running entirely on your machine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.prompt}
              type="button"
              onClick={() => onSelectPrompt(suggestion.prompt)}
              className="group flex items-center gap-3 rounded-xl border border-line-subtle bg-surface-primary p-3.5 text-left transition-all duration-fast ease-out hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                <suggestion.icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-content-primary">{suggestion.title}</span>
                <span className="block truncate text-xs text-content-muted">{suggestion.prompt}</span>
              </span>
            </button>
          ))}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-content-muted">
          <Cpu size={12} className={ollamaHealthy ? 'text-ok' : 'text-warn'} />
          {ollamaHealthy
            ? 'Running locally via Ollama · your data never leaves this device'
            : 'Waiting for Ollama · start it with `ollama serve`'}
          <MessageSquare size={12} className="ml-1 opacity-0" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}
