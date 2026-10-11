/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS variables. These are the single
        // source of truth — components must consume these, not invent colors.
        background: {
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
        },
        surface: {
          primary: 'rgb(var(--surface-primary) / <alpha-value>)',
          secondary: 'rgb(var(--surface-secondary) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          inverse: 'rgb(var(--text-inverse) / <alpha-value>)',
        },
        line: {
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          solid: 'rgb(var(--accent-solid) / <alpha-value>)',
          'on': 'rgb(var(--on-accent) / <alpha-value>)',
          subtle: 'rgb(var(--accent-subtle) / <alpha-value>)',
        },
        ok: {
          DEFAULT: 'rgb(var(--ok) / <alpha-value>)',
          subtle: 'rgb(var(--ok-subtle) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'rgb(var(--warn) / <alpha-value>)',
          subtle: 'rgb(var(--warn-subtle) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          subtle: 'rgb(var(--danger-subtle) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.05rem' }],
        'sm': ['0.875rem', { lineHeight: '1.35rem' }],
        'base': ['1rem', { lineHeight: '1.65rem' }],
        'lg': ['1.125rem', { lineHeight: '1.85rem' }],
        'xl': ['1.25rem', { lineHeight: '1.85rem' }],
        '2xl': ['1.5rem', { lineHeight: '2.1rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.45rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.7rem' }],
      },
      borderRadius: {
        'sm': '0.375rem',
        'DEFAULT': '0.5rem',
        'md': '0.625rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        'full': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'md': '0 4px 10px -2px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'lg': '0 12px 28px -6px rgb(0 0 0 / 0.16), 0 4px 10px -4px rgb(0 0 0 / 0.08)',
        'xl': '0 24px 48px -12px rgb(0 0 0 / 0.22)',
      },
      transitionDuration: {
        instant: '80ms',
        fast: '140ms',
        base: '200ms',
        slow: '300ms',
        slower: '400ms',
      },
      transitionTimingFunction: {
        'out': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in': 'cubic-bezier(0.64, 0, 0.78, 0)',
        'soft': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.34, 1.3, 0.64, 1)',
      },
      animation: {
        'fade-in': 'aurora-fade-in var(--motion-base) var(--ease-out) both',
        'slide-up': 'aurora-slide-up var(--motion-slow) var(--ease-out) both',
        'slide-in-right': 'aurora-slide-in-right var(--motion-base) var(--ease-out) both',
        'scale-in': 'aurora-scale-in var(--motion-fast) var(--ease-out) both',
        'message-in': 'aurora-message-in var(--motion-slow) var(--ease-out) both',
        'shimmer': 'aurora-shimmer 1.6s linear infinite',
        'blink': 'aurora-blink 1s steps(2, start) infinite',
        'spin-slow': 'spin 1.4s linear infinite',
      },
      keyframes: {
        'aurora-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'aurora-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'aurora-slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'aurora-scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'aurora-message-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'aurora-shimmer': {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'aurora-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
