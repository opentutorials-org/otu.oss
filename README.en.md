# 📝 OTU

> AI-Powered Smart Memo Application - Record your thoughts, let AI help you remember

[한국어](README.md)

[![Version](https://img.shields.io/badge/version-0.5.201-blue.svg)](https://github.com/opentutorials-org/otu.oss)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)

**OTU** is a next-generation AI memo application supporting both web and mobile. It leverages the BlockNote editor and OpenAI GPT-4o to provide auto-save, AI-powered title generation, smart search, and reminder systems.

## ✨ Key Features

- 🤖 **AI-Integrated Editor**: Text improvement, summarization, translation via BlockNote XL-AI extension
- 💾 **Auto-Save**: Safe saving during continuous editing with 3-second debounce
- 🔍 **Smart Search**: RAG-based document search and AI chat
- 📁 **Folder System**: Organize memos systematically
- 🔔 **Smart Reminders**: Review important memos with exponential alarm intervals
- 🌓 **3 Themes**: Gray, white, and black modes
- 🌐 **Multilingual Support**: Korean and English
- 🔄 **Real-time Sync**: WatermelonDB + Supabase

## 📑 Table of Contents

1. [🚀 Quick Start](#-quick-start)
2. [⚙️ Getting Started](#️-getting-started)
    - [Requirements](#requirements)
    - [Tech Stack](#tech-stack)
    - [Environment Variables](#environment-variables)
    - [Running Development Server](#running-development-server)
3. [🏗️ Architecture](#️-architecture)
4. [🧪 Testing](#-testing)
5. [🚀 Deployment](#-deployment)
6. [📚 Development Guide](#-development-guide)
7. [🤝 Contributing](#-contributing)
8. [📄 Additional Documentation](#-additional-documentation)

---

## 🚀 Quick Start

### Installing with AI Agents

If you're using AI coding agents like Claude Code, Cursor, or Windsurf, copy and paste the following prompt:

```
Follow this installation guide to set up the OTU project:
https://raw.githubusercontent.com/opentutorials-org/otu.oss/main/docs/installation.md
```

### Manual Installation

A minimal setup guide for new developers.

```bash
# 1. Clone repository
git clone https://github.com/opentutorials-org/otu.oss.git
cd otu.oss

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.template .env.local

# 4. Start local Supabase
npx supabase start
```

When Supabase starts, key information will be displayed in the terminal:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGci...
service_role key: eyJhbGci...
```

**Open `.env.local` and configure the keys:**

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
```

```bash
# 5. Initialize database
npm run db-sync

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

> 💡 **Tip**: In development, you can use email login at the `/signin` path.

📖 **Detailed Installation Guide**: [docs/installation.md](docs/installation.md) - Environment variables, troubleshooting, and more

---

## ⚙️ Getting Started

### Requirements

- **Node.js**: v20.5.0 or higher
- **npm**: 10.8.1 or higher
- **Docker**: For local Supabase development
- **Git**: Version control

### Tech Stack

| Category             | Technology                                    |
| -------------------- | --------------------------------------------- |
| **Frontend**         | Next.js 16, React 19, TypeScript 5.7          |
| **Database**         | Supabase (PostgreSQL), WatermelonDB           |
| **State Management** | Jotai, React Query                            |
| **UI Library**       | Material-UI, Tailwind CSS                     |
| **Editor**           | BlockNote 0.44.0 + XL-AI extension            |
| **AI Service**       | OpenAI GPT-4o, Vercel AI Gateway              |
| **Routing**          | React Router DOM (client), Next.js App Router |
| **Testing**          | Jest (⚠️ Not Vitest!)                         |
| **Monitoring**       | Vercel Logs, Console Logging                  |

### Environment Variables

Create a `.env.local` file in the project root and set the following variables.

#### Required Variables

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Host Configuration (Required)
NEXT_PUBLIC_HOST=http://localhost:3000
```

#### AI Feature Settings

To use AI features like chat, auto title generation, and RAG search, set the following:

```bash
# Enable AI Features (default: false)
# Set to true to activate AI features
ENABLE_AI=true

# OpenAI API Key (Required when ENABLE_AI=true in development)
OPENAI_API_KEY=your_openai_api_key
# In production, AI and embedding features are provided through Vercel AI Gateway.
```

> ⚠️ **Note**: When `ENABLE_AI=false` (default), the app works normally but AI-related features (chat, auto title generation, smart search, etc.) are disabled.

#### Optional Variables

```bash
# Uploadcare (Image upload)
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=your_uploadcare_key

# Social Login Redirect
NEXT_PUBLIC_SOCIAL_LOGIN_REDIRECT_TO=http://localhost:3000
```

### Running Development Server

```bash
# Default development server (Turbopack)
npm run dev

# Access via IP address (mobile testing)
npm run dev:ip

# Debugging mode
npm run dev:inspect

# Run with type checking
npm run dev && npm run type-check
```

### Main npm Scripts

#### Development

```bash
npm run dev                 # Default development server
npm run dev:ip             # For mobile testing (IP specified)
npm run dev:inspect        # Enable Node Inspector
```

#### Testing

```bash
npm test                   # Jest unit tests
npm run test:integration   # Integration tests (requires local Supabase)
npm run type-check         # TypeScript type checking
```

#### Build & Deploy

```bash
npm run build              # Production build
npm run deploy_preview     # Deploy to development environment (Vercel)
npm run deploy             # Production deployment
```

#### Database

```bash
npm run db-sync                    # Initialize local DB and generate types
npm run supabase-start             # Start local Supabase
npm run supabase-stop              # Stop local Supabase
npm run supabase-generate-database-types  # Generate type definition files
```

### Branch Strategy

We follow Git Flow:

- **`main`**: Production deployment branch (no direct work ⛔)
- **`dev`**: Development branch (daily work)
- **`feature/*`**: Feature development branches (independent work)

```bash
# Start new feature development
git checkout dev
git pull origin dev
git checkout -b feature/my-new-feature

# After completion, merge to dev
git checkout dev
git merge feature/my-new-feature
git push origin dev
```

### Debugging

#### VSCode Debugger

1. Copy `.vscode.template` → rename to `.vscode`
2. Select "Debug Nextjs with Edge" and run
3. Edge browser opens automatically
4. Refresh browser after Next.js is ready

#### Debug Logs

Using [debug-js/debug](https://github.com/debug-js/debug) library:

```bash
# Server: Add to .env
DEBUG=sync,editor,chat

# Browser: In developer console
localStorage.debug = 'sync,editor,chat'
```

Available namespaces:

- `sync` - Data synchronization
- `editor` - Editor related
- `chat` - AI chat
- `auth` - Authentication
- Others: See `src/debug/` directory

#### Mobile Debugging

1. Tap 5 times on the top-left corner of the screen
2. Eruda console activates
3. Check debugging info in Menu > Settings

---

## 🏗️ Architecture

### Directory Structure

```
.
├── app/                      # Next.js App Router
│   ├── (ui)/                # UI page group
│   │   ├── home/           # Main home (React Router DOM)
│   │   ├── signin/         # Login
│   │   └── ...
│   ├── api/                # API routes
│   │   ├── ai/            # AI endpoints
│   │   ├── sync/          # Data synchronization
│   │   ├── usage/         # Usage tracking
│   │   ├── reminder/      # Alarm management
│   │   └── ...
│   └── auth/              # Authentication related
│
├── src/
│   ├── components/        # React components
│   │   ├── Chat/         # AI chat
│   │   ├── common/       # Shared components
│   │   ├── home2/        # Home (React Router based)
│   │   ├── layout/       # Layout
│   │   └── ...
│   │
│   ├── functions/         # Utility functions
│   │   ├── ai/           # AI services
│   │   ├── hooks/        # Custom hooks
│   │   └── usage/        # Usage tracking
│   │
│   ├── watermelondb/      # Local DB (offline support)
│   │   ├── model/        # Model definitions
│   │   ├── control/      # DB control logic
│   │   ├── schema.ts     # Schema
│   │   ├── sync.ts       # Sync logic (40KB+)
│   │   └── migrations.ts # Migrations
│   │
│   └── debug/             # Debug loggers
│
├── supabase/              # Supabase configuration
│   ├── migrations/       # DB migrations
│   └── ...
│
└── messages/              # Internationalization
    ├── ko.json           # Korean
    └── en.json           # English
```

### Core Architecture Patterns

#### 1. Data Layer

```
┌─────────────┐
│  Supabase   │  ← Server source of truth
│  (PostgreSQL)│
└──────┬──────┘
       │ Bidirectional sync
       ↓
┌─────────────┐
│ WatermelonDB │  ← Local cache + offline
└──────┬──────┘
       │ Observer pattern
       ↓
┌─────────────┐
│   Jotai     │  ← UI state management
└──────┬──────┘
       │
       ↓
   React UI
```

**Features:**

- **Incremental sync**: Prevents duplicates with `gt` operator
- **Concurrency control**: Queue-based approach prevents race conditions with sequential processing
- **Offline-first**: Immediate response from local DB

#### 2. Navigation

```
┌──────────────────┐
│  Next.js Router  │  ← Page-level routing
└────────┬─────────┘
         │
    /home area
         │
         ↓
┌──────────────────┐
│ React Router DOM │  ← Client routing
│   (SPA mode)      │    (fast transitions)
└──────────────────┘
```

**Patterns:**

- URL as single source of truth
- Uses `useNavigate`, `useLocation`, `useParams`
- Protected routes: Automatic login redirect

#### 3. AI Integration

```
BlockNote 0.44.0 Editor
    ↓
  XL-AI Extension
    ↓
  Proxy API (/api/ai/proxy)
    ↓
  Vercel AI Gateway
    ↓
  OpenAI GPT-4o
```

**Features:**

- AI formatting toolbar
- AI slash menu
- Image AI captioning (2-stage processing)
- Auto title generation
- RAG-based document search

---

## 🧪 Testing

### Jest Unit Tests

The project uses **Jest** as the testing framework. (⚠️ Not Vitest!)

```bash
# Run all tests
npm test

# Run specific test file
npx jest path/to/test.test.ts

# Watch mode
npx jest --watch
```

#### Test Environment Setup

Jest automatically distinguishes execution environment via file header comments:

**Node.js environment (API, server logic)**

```typescript
/** @jest-environment node */
import { POST } from './route';
```

**jsdom environment (React components, DOM)**

```typescript
/** @jest-environment jsdom */
import { render } from '@testing-library/react';
```

#### Test File Conventions

- Test file names: `*.test.ts` or `*.test.tsx`
- Location: Same directory as the target file
- Example: `useReminderList.tsx` → `useReminderList.test.tsx`

### Integration Tests (DB dependent)

```bash
npm run test:integration
```

Tests that require local Supabase:

- DB sync tests
- Alarm API tests
- Account deletion API tests

---

## 🚀 Deployment

### Development Environment Deployment

```bash
npm run deploy_preview
```

- Target: Vercel Preview environment
- Branch: `dev`
- Provides preview URL after deployment

### Production Deployment

```bash
npm run deploy
```

**Auto-processed:**

1. Switch to `main` branch
2. Merge `dev` branch
3. Auto version update (`standard-version`)
4. Create and push Git tags
5. Vercel production deployment

### Deployment Checklist

- [ ] All tests pass (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Local build succeeds (`npm run build`)
- [ ] Review migration files
- [ ] Verify environment variable updates
- [ ] Check CHANGELOG.md

---

## 📚 Development Guide

### Core Development Principles

#### 1. React Router Navigation

Use React Router DOM in the home area (`/home/*`):

```typescript
import { useNavigate, useParams } from 'react-router-dom';

function MyComponent() {
    const navigate = useNavigate();
    const { pageId } = useParams();

    // ✅ Correct way
    navigate('/home/page/123');

    // ❌ Do not use
    router.push('/home/page/123');
}
```

#### 2. State Management

```typescript
// ✅ Global state: Jotai
import { atom, useAtom } from 'jotai';

// ✅ Local state: useState, useImmer
const [state, setState] = useImmer(initialState);

// ✅ Server state: WatermelonDB (observer pattern)
const pages = useFoldersData();
```

#### 3. Internationalization

```typescript
// Client
import { useTranslations } from 'next-intl';
const t = useTranslations('namespace');

// Server
const t = await getTranslations('namespace');
```

#### 4. Error Handling

```typescript
try {
    await someAsyncOperation();
} catch (error) {
    console.error('Operation error:', error);
}
```

### Detailed Documentation

For more detailed development guides, refer to the following:

- **Feature List**: [`/docs/meta-guides/functionality.md`](docs/meta-guides/functionality.md)
- **Mechanism Documentation**: [`/docs/`](docs/) directory
- **CLAUDE.md**: Project guide for AI assistants (includes coding style)

---

## 🤝 Contributing

### How to Contribute

1. **Check Issues**: Select an issue from [GitHub Issues](https://github.com/opentutorials-org/otu.oss/issues)
2. **Create Branch**: Format: `feature/issue-number-brief-description`
3. **Develop**: Follow coding style guide
4. **Test**: Ensure all tests pass
5. **Commit**: Conventional Commits format
6. **Pull Request**: Create PR to `dev` branch

### Commit Message Convention

```
feat: Add new feature

Reason for change:
- Feature requested by users.

How to test:
1. Start development server
2. Navigate to /home/page
3. Click new feature button
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting
- `refactor`: Refactoring
- `test`: Add/modify tests
- `chore`: Build, configuration changes

### Code Review Guide

- PRs require at least 1 approval
- All tests must pass
- Type check must pass
- Must follow coding style guide

## 📄 Additional Documentation

### Basic Setup Guide

- https://supabase.com/docs/guides/auth/server-side/creating-a-client?environment=server-component#creating-a-client

### Supabase Database Setup

To create a project and set up a database on supabase.com:

- Configure the .env file based on project settings from supabase.com
- Connect to Supabase: `npx supabase link`
- Create database on Supabase: `npx supabase db push`

### Client Component

```typescript
"use client";

import { createClient } from "@/supabase/utils/client"

export default function Page() {
  const supabase = createClient();
  return ...
}
```

### Server Component

```typescript
import { createClient } from "@/supabase/utils/server"
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = cookies()
  const supabase = await createClient();
  return ...
}
```

```typescript
let query = supabase.from('page').select('id, title').eq('user_id', user.id);
```

### Super Role DB Client

```typescript
import { createSuperClient } from '@/supabase/utils/super';
const superSupabase = createSuperClient();
// When fetching data with service role key, user value cannot be obtained, so use createClient.
const user = await supabase.auth.getUser();
```

### Service Role RLS Setup

```sql
alter policy "Allow service role to insert"
on "public"."usage"
to service_role
with check (
  true
);
```

---

## Additional Documentation

For more information, refer to the following documents:

### Core Documents

- **CLAUDE.md**: Project guide for AI assistants (includes coding style)
- **Feature List**: `/docs/meta-guides/functionality.md`
    - User management and authentication
    - Editing features (BlockNote, AI integration)
    - Folder system and search
    - Alarm/reminder system

### Mechanism Documentation

`/docs/` directory (prefix-based categorization):

- **[docs/README.md](docs/README.md)** - 📚 Complete documentation index and guide

**Meta Guides (meta-guides/)**:

- `functionality.md` - Complete feature specification

**Domain Systems (domain-\*)**:

- `domain-authentication/` - Authentication and user ID management (2 documents)
- `domain-reminders/` - Alarm system (2 documents)

**Features (feature-\*)**:

- `feature-editor/` - Editor auto-save and embedding (1 document)
- `feature-chat/` - AI chat RAG and embedding (2 documents)

**Core Mechanisms (core-\*)**:

- `core-data/` - WatermelonDB sync, sample data, folders (3 documents)
- `core-routing/` - React Router navigation (2 documents)
- `core-ui/` - Theme, z-index, responsive layout (5 documents)
- `core-architecture/` - Performance optimization, HOC patterns, sharing (3 documents)

**Testing (test/)**:

- `test-status.md` - Complete test status

> **Note**: docs/README.md provides the complete documentation structure and reading order.
