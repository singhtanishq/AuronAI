# Auron AI Development Guide

## Getting Started

### Prerequisites

- Node.js 20+
- Ollama installed and running
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/AuronAI.git
cd AuronAI

# Install all dependencies
npm install

# Pull default model
ollama pull qwen2.5:3b

# Start development servers
npm run dev
```

## Project Structure

```
AuronAI/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Express + TypeScript
├── docs/              # Documentation
├── package.json       # Root workspace config
└── README.md
```

## Development Commands

### Root Level

```bash
# Install all dependencies
npm install

# Run both frontend and backend
npm run dev

# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Build all packages
npm run build

# Lint all packages
npm run lint

# Type check all packages
npm run typecheck

# Run tests
npm run test

# Initialize database
npm run db:init
```

### Frontend (cd frontend)

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Type check
npm run typecheck

# Tests
npm run test
```

### Backend (cd backend)

```bash
# Development with hot reload
npm run dev

# Build
npm run build

# Start production
npm run start

# Lint
npm run lint

# Type check
npm run typecheck

# Tests
npm run test

# Database
npm run db:init
npm run db:migrate
```

## Coding Conventions

### TypeScript

- Strict mode enabled
- No `any` unless absolutely necessary
- Use explicit types for function parameters
- Prefer interfaces over type aliases for objects
- Use `const` assertions for literal types

### React

- Functional components with hooks
- Custom hooks for reusable logic
- `React.FC` not required (implicit from JSX)
- Props destructuring in parameter
- Default exports for pages, named exports for components

### CSS/Tailwind

- Use Tailwind utility classes
- Custom CSS only in `styles/index.css`
- Follow design system tokens (colors, spacing, etc.)
- Mobile-first responsive design

### Backend

- Routes in `src/routes/`
- Business logic in `src/services/`
- Data access in `src/repositories/`
- Validation with Zod schemas
- Error handling via middleware

## Adding New Features

### New API Endpoint

1. Create route file in `backend/src/routes/`
2. Add Zod validation schemas
3. Implement route handlers
4. Register in `backend/src/app.ts`

```typescript
// backend/src/routes/myFeature.ts
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const mySchema = z.object({
  field: z.string().min(1),
});

router.post('/', authMiddleware, validateBody(mySchema), asyncHandler(async (req, res) => {
  // Implementation
  res.json({ success: true });
}));

export default router;
```

```typescript
// backend/src/app.ts
import myFeatureRoutes from './routes/myFeature';
app.use('/api/my-feature', myFeatureRoutes);
```

### New Frontend Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`

```tsx
// frontend/src/pages/MyPage.tsx
import { useAuth } from '../contexts/AuthContext';

export function MyPage() {
  const { user } = useAuth();
  return <div>Hello {user?.name}</div>;
}
```

```tsx
// frontend/src/App.tsx
import { MyPage } from './pages/MyPage';

<Route path="/my-page" element={<MyPage />} />
```

### New UI Component

1. Create in `frontend/src/components/ui/`
2. Export from `frontend/src/components/ui/index.ts`

```tsx
// frontend/src/components/ui/MyComponent.tsx
import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface MyComponentProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  ({ variant = 'primary', children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('base-classes', variant === 'primary' ? 'primary-classes' : 'secondary-classes', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

MyComponent.displayName = 'MyComponent';
```

```typescript
// frontend/src/components/ui/index.ts
export { MyComponent } from './MyComponent';
```

### New AI Provider

1. Implement `AIProvider` interface in `backend/src/providers/`
2. Register in `backend/src/providers/index.ts`

```typescript
// backend/src/providers/myProvider.ts
import { AIProvider, BaseAIProvider } from './aiProvider';
import { ChatRequest, StreamChunk, ModelInfo } from '../types';

export class MyProvider extends BaseAIProvider {
  name = 'my-provider';

  async generate(request: ChatRequest): Promise<string> {
    // Implementation
  }

  async stream(request: ChatRequest, onChunk: (chunk: StreamChunk) => void): Promise<void> {
    // Implementation
  }

  async listModels(): Promise<ModelInfo[]> {
    // Implementation
  }

  async healthCheck(): Promise<{ reachable: boolean; models: number; defaultModel?: string; error?: string }> {
    // Implementation
  }
}
```

```typescript
// backend/src/providers/index.ts
import { MyProvider } from './myProvider';

export function createMyProvider(): MyProvider {
  return new MyProvider();
}
```

## Database Migrations

### Creating Migrations

```bash
# Create migration file manually in backend/src/database/
# Run with tsx
tsx backend/src/database/migrate.ts
```

### Migration Example

```typescript
// backend/src/database/migrate.ts
import { getDatabase } from './index';

export function migrate(): void {
  const db = getDatabase();
  
  // Add new column
  db.exec(`
    ALTER TABLE conversations ADD COLUMN new_field TEXT;
  `);
  
  // Create new table
  db.exec(`
    CREATE TABLE IF NOT EXISTS new_table (
      id TEXT PRIMARY KEY,
      ...
    );
  `);
}
```

## Testing

### Backend Unit Tests

```typescript
// backend/src/__tests__/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../services/authService';
import { userRepository } from '../repositories/userRepository';

describe('Auth Service', () => {
  beforeEach(async () => {
    // Clean database
  });

  it('should create user', async () => {
    const user = await authService.signup('Test', 'test@example.com', 'password123', 'password123');
    expect(user.user.name).toBe('Test');
  });
});
```

### Frontend Component Tests

```tsx
// frontend/src/components/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../ui/Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('handles click', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Debugging

### Backend Debugging

```bash
# VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "cwd": "${workspaceFolder}/backend"
}
```

### Frontend Debugging

```bash
# VS Code launch.json
{
  "type": "chrome",
  "request": "launch",
  "name": "Debug Frontend",
  "url": "http://localhost:5173",
  "webRoot": "${workspaceFolder}/frontend/src"
}
```

### Database Inspection

```bash
# Open SQLite database
sqlite3 backend/data/auron.db

# Useful queries
.tables
.schema users
SELECT * FROM conversations;
SELECT * FROM messages WHERE conversation_id = '...';
```

## Common Issues

### Port Conflicts

```bash
# Backend port in use
PORT=3002 npm run dev:backend

# Frontend port in use - modify vite.config.ts
server: { port: 5174 }
```

### Ollama Connection Issues

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
ollama serve
# or
brew services restart ollama
```

### Module Resolution Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules frontend/node_modules backend/node_modules
npm install
```

### TypeScript Errors

```bash
# Check types
npm run typecheck

# Frontend only
cd frontend && npm run typecheck

# Backend only
cd backend && npm run typecheck
```

## Environment Variables

### Development (.env files)

Create `.env` files in frontend/ and backend/ from examples:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

### Key Variables

| Variable | Purpose |
|----------|---------|
| `OLLAMA_BASE_URL` | Ollama API endpoint |
| `OLLAMA_DEFAULT_MODEL` | Default model name |
| `DATABASE_PATH` | SQLite file location |
| `SESSION_SECRET` | JWT signing key |
| `FRONTEND_URL` | CORS origin |

## Git Workflow

### Branch Naming

- Feature: `feature/description`
- Bug fix: `fix/description`
- Refactor: `refactor/description`
- Docs: `docs/description`

### Commit Messages

Follow conventional commits:

```
feat: add chat search functionality
fix: resolve streaming abort issue
refactor: simplify message rendering
docs: update architecture documentation
test: add auth service tests
```

### Pre-commit

Run before committing:

```bash
npm run lint
npm run typecheck
npm run test
```

## Performance Profiling

### Backend

```bash
# Add profiling
node --inspect backend/dist/server.js

# Or use clinic.js
npx clinic doctor -- node backend/dist/server.js
```

### Frontend

```bash
# React DevTools Profiler
# Chrome DevTools Performance tab
# Lighthouse for production builds
```

## Deployment Checklist

- [ ] All tests pass
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] Production build succeeds
- [ ] Environment variables configured
- [ ] Ollama running with required models
- [ ] Database migrations applied
- [ ] SSL certificates (if HTTPS)
- [ ] Reverse proxy configured (nginx/Traefik)
- [ ] Health checks responding