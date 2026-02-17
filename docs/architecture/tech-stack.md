# Tech Stack

## Framework & Runtime

### Next.js 16.1.6

**Why Next.js?**
- Server-side rendering for improved SEO and performance
- App Router for modern React patterns
- API routes for backend functionality
- Built-in optimization for images, fonts, and scripts
- Excellent TypeScript support

**Configuration**:
- Output: `standalone` (for Docker deployment)
- Integrated with `next-intl` for internationalization

### React 19.2.3

**Why React 19?**
- Latest concurrent features
- Improved server components support
- Better hydration performance
- New hooks and APIs

### TypeScript 5.x

**Why TypeScript?**
- Type safety across the entire codebase
- Better IDE support and autocompletion
- Catch errors at compile time
- Self-documenting code through types

---

## Database & ORM

### PostgreSQL

**Why PostgreSQL?**
- Robust, production-ready relational database
- Excellent support for complex queries
- JSON support for flexible data
- Strong transaction guarantees

### Drizzle ORM 0.45.1

**Why Drizzle?**
- TypeScript-first ORM with excellent type inference
- SQL-like syntax, close to native SQL
- Lightweight with zero runtime overhead
- Excellent migration tools

**Configuration**:
```typescript
// drizzle.config.ts
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL }
};
```

---

## Styling

### Tailwind CSS 4.x

**Why Tailwind?**
- Utility-first CSS for rapid development
- Excellent performance with JIT compilation
- Consistent design system
- Great integration with component libraries

### shadcn/ui + Radix UI

**Why This Combination?**
- Accessible, unstyled components from Radix UI
- Pre-styled, copy-paste components from shadcn/ui
- Full control over component code
- Consistent with Tailwind design system

**Key Components Used**:
- `@radix-ui/react-progress` - Progress indicators
- `@radix-ui/react-toast` - Toast notifications
- Custom shadcn components for forms, dialogs, etc.

### Additional Styling Tools

| Package | Purpose |
|---------|---------|
| `class-variance-authority` | Component variant management |
| `clsx` | Conditional class names |
| `tailwind-merge` | Merge Tailwind classes |
| `tw-animate-css` | Animation utilities |

---

## AI Integration

### Vercel AI SDK 6.0.85

**Why Vercel AI SDK?**
- First-class React hooks for AI interactions
- Streaming responses for better UX
- Tool calling for structured AI actions
- Works with multiple AI providers

**Components Used**:
- `ai` - Core SDK
- `@ai-sdk/openai` - OpenAI provider
- `@ai-sdk/react` - React hooks (`useChat`)

### OpenAI Integration

**Why OpenAI?**
- State-of-the-art language models
- Excellent function calling support
- Reliable API and documentation

---

## Forms & Validation

### React Hook Form 7.71.1

**Why React Hook Form?**
- Performant form handling with minimal re-renders
- Excellent validation integration
- Built-in form state management
- Great developer experience

### Zod 4.3.6

**Why Zod?**
- TypeScript-first schema validation
- Excellent type inference
- Reusable validation schemas
- Integration with React Hook Form via `@hookform/resolvers`

---

## Internationalization

### next-intl 4.8.2

**Why next-intl?**
- Server and client components support
- ICU message format
- Built-in formatting for dates, numbers, currencies
- SEO-friendly with localized routing

**Supported Languages**:
- German (de) - Default
- English (en)

---

## Data Visualization

### Recharts 3.7.0

**Why Recharts?**
- React-native charting library
- Responsive and accessible
- Customizable styling with Tailwind
- Good TypeScript support

**Use Cases**:
- Monthly overview charts
- Category breakdown visualizations
- Forecast projections

---

## Utilities

### date-fns 4.1.0

**Why date-fns?**
- Modular date utility functions
- Tree-shakeable for smaller bundles
- Immutable date operations
- Excellent TypeScript support

### sonner 2.0.7

**Why sonner?**
- Minimal toast notification library
- Beautiful default styling
- Promise-based API
- Stacking support

---

## Development Tools

### ESLint 9.x

**Purpose**: Code quality and consistency

### Semantic Release

**Purpose**: Automated versioning and releases

**Plugins Used**:
- `@semantic-release/changelog` - Auto-generate changelog
- `@semantic-release/git` - Commit release changes
- `@semantic-release/github` - GitHub releases
- `@semantic-release/exec` - Execute shell commands

---

## Deployment

### Docker Support

**Configuration**:
- Multi-stage builds for optimized images
- Standalone Next.js output
- Docker Compose for local development

**Files**:
- `Dockerfile` - Production image
- `docker-compose.yml` - Development setup
- `docker-compose.selfhost.yml` - Self-hosted deployment

---

## Key Dependency Versions Summary

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework |
| react | 19.2.3 | UI Library |
| drizzle-orm | 0.45.1 | ORM |
| postgres | 3.4.8 | PostgreSQL client |
| ai | 6.0.85 | AI SDK |
| zod | 4.3.6 | Validation |
| react-hook-form | 7.71.1 | Forms |
| recharts | 3.7.0 | Charts |
| tailwindcss | 4.x | Styling |
| next-intl | 4.8.2 | i18n |
