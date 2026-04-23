# AI Orchestrator Dashboard

A local dashboard for monitoring AI orchestrator runs. It watches run artifacts (tasks, phase logs, worker logs) produced by the orchestrator on disk and surfaces them in a live UI — projects in a sidebar, per-run phases/tasks/agents in a detail view, with token usage, status, and recent log tails.

## Stack

- **Client:** React 19 + TypeScript, Vite, Tailwind 4, Base UI / shadcn components, React Router
- **Server:** Express 5 (TypeScript via `tsx`) — reads run data from the local filesystem and exposes it over a small JSON API
- **Config:** Projects persist to `.data/projects.json` inside the repo (gitignored)

## Prerequisites

- Node.js **>= 20** (use `nvm use v20`)
- An orchestrator run directory on disk to point the dashboard at

## Getting started

```bash
nvm use v20
npm install
npm run dev
```

This starts both processes concurrently:

- Client (Vite) on <http://localhost:4000>
- API server on <http://localhost:4001>

Override the API port with `PORT=<n> npm run dev:server` if needed.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run client + server together |
| `npm run dev:client` | Vite dev server only |
| `npm run dev:server` | API server with file watching (`tsx watch`) |
| `npm run build` | Type-check and build the client |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

## Project layout

```
server/          Express API (projects, runs, browse, health)
  routes/        HTTP routes
  services/      project-store, run-reader
src/
  components/
    dashboard/   Run detail, phases, tasks, agents
    layout/      Sidebar + header
    projects/    Project add/remove UI
    ui/          Base UI / shadcn primitives
  hooks/         use-polling, use-theme, use-mobile
  lib/
```

## Budget tracking

Budgets are read directly from each run's `tasks.json`:

- `totalBudgetUsd` — powers the Cost stat card (headline cost vs. budget)
- `maxBudgetPerTaskUsd` — powers a small circular progress ring on every task row (including single-task phases). Hover the ring for a tooltip with the raw `cost / budget` numbers.

If either field is missing, the dashboard falls back to defaults defined in `server/constants.ts` (`DEFAULT_BUDGET`, `DEFAULT_MAX_BUDGET_PER_TASK`).

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Health check |
| `/api/projects` | CRUD for tracked projects |
| `/api/runs` | Read run state (tasks, phases, logs, token usage) |
| `/api/browse` | Filesystem browser for picking run directories |
