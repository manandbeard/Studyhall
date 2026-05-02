# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Study Hall Tracker (`artifacts/study-hall-tracker`)
- **Kind**: web (React + Vite, Tailwind v4)
- **Preview path**: `/`
- **Port**: 18763
- **Purpose**: Real-time hall pass tracking system for schools
- **Backend**: Firebase/Firestore (projectId: `studentprojector`, database: `ai-studio-1c541bf6-fa20-4e53-8349-02d963b8d16c`)
- **Auth**: Firebase Google Auth, restricted to `@nbend.k12.or.us` domain
- **Design**: Neo-brutalist (bold black borders, yellow/blue/green/red accents, white backgrounds)
- **Key dependencies**: `firebase`, `date-fns`, `wouter` (routing), `lucide-react`
- **Env vars**: None required in the frontend (Gemini calls are proxied through the API server)
- **API server dependency**: The admin "Bulk Import" feature calls `POST /api/gemini/parse-roster` on the API server — requires `GEMINI_API_KEY` (server env var). Requests are authenticated via Firebase ID token (`Authorization: Bearer <token>`) and rate-limited to 10 req/min per user.
- **Routes**:
  - `/` — LoginPage (Google sign-in)
  - `/teacher` — TeacherDashboard (pass requests, roster, attendance)
  - `/admin` — AdminDashboard (live feed, teacher mgmt, stats, audit log, bulk import)
- **Roles**: `teacher` | `admin` (admin: `nhelland@nbend.k12.or.us`)

### API Server (`artifacts/api-server`)
- Pre-existing scaffold; not used by Study Hall Tracker (purely Firebase frontend)

### Canvas / Mockup Sandbox (`artifacts/mockup-sandbox`)
- Pre-existing design tooling scaffold
