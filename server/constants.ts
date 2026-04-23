import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TokenUsage } from './types.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─── Server ─────────────────────────────────────────────────────────────────

export const DEFAULT_PORT = 4001;
export const CORS_ORIGIN = 'http://localhost:4000';

// ─── API Routes ─────────────────────────────────────────────────────────────

export const ApiRoute = {
  Projects: '/api/projects',
  Runs: '/api/runs',
  Browse: '/api/browse',
  Health: '/api/health',
} as const;

// ─── Config Storage ─────────────────────────────────────────────────────────

export const CONFIG_DIR = path.join(PROJECT_ROOT, '.data');
export const PROJECTS_FILE = path.join(CONFIG_DIR, 'projects.json');

export const JSON_INDENT = 2;
export const FILE_ENCODING = 'utf-8' as const;

// ─── Run Reader ─────────────────────────────────────────────────────────────

export const DEFAULT_BUDGET = 20;
export const RECENT_LOG_COUNT = 20;
export const PER_FILE_TAIL_COUNT = 20;

export const ZERO_TOKENS: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
};

// ─── Run File/Folder Names ──────────────────────────────────────────────────

export const RUN_FILES = {
  tasks: 'tasks.json',
  logsDir: 'logs',
  jsonlExt: '.jsonl',
  workerLogPrefix: 'worker-',
} as const;

// ─── Log File Names ─────────────────────────────────────────────────────────

export const ORCHESTRATOR_LOG_FILE = 'orchestrator.jsonl';

// ─── Task / Step / Phase / Run Status ───────────────────────────────────────

export const TaskStatusValue = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
  Failed: 'failed',
  Blocked: 'blocked',
} as const;

export const StepStatusValue = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
  Failed: 'failed',
  Skipped: 'skipped',
} as const;

export const PhaseStatusValue = {
  Pending: 'pending',
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
  Skipped: 'skipped',
} as const;

export const RunStatusValue = {
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Pending: 'pending',
} as const;

// ─── Log Actions ────────────────────────────────────────────────────────────

export const LogAction = {
  Start: 'start',
  ToolUse: 'tool_use',
  Complete: 'complete',
  SessionEnd: 'session_end',
  Error: 'error',
  Config: 'config',
  Git: 'git',
  Phase: 'phase',
} as const;

// ─── Phase Display ──────────────────────────────────────────────────────────

export const GIT_SETUP_PHASE_ID = 1;
export const GIT_SETUP_LABEL = 'Git Setup';

export const ORCHESTRATOR_AGENT = 'orchestrator';

// ─── Agent Status Order ─────────────────────────────────────────────────────

export const AgentStatusValue = {
  Running: 'running',
  Pending: 'pending',
  Done: 'done',
  Failed: 'failed',
} as const;

export const AGENT_STATUS_ORDER: Record<string, number> = {
  [AgentStatusValue.Running]: 0,
  [AgentStatusValue.Pending]: 1,
  [AgentStatusValue.Done]: 2,
  [AgentStatusValue.Failed]: 3,
};

// ─── Description Defaults ───────────────────────────────────────────────────

export const DEFAULT_DESCRIPTION = 'Initializing...';
export const DEFAULT_BASE_BRANCH = 'unknown';
export const TICKET_BRANCH_PREFIX = 'ticket/';

// ─── Orchestrator Parsing ───────────────────────────────────────────────────

export const ORCHESTRATOR_START_PREFIX_PATTERN = /^Starting agent loop for \S+\s*/;
export const GIT_BRANCH_PATTERN = /branch\s+(\S+)\s+from\s+(\S+)/;
