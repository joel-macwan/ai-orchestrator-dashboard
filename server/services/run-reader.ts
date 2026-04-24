import fs from 'node:fs';
import path from 'node:path';
import type {
  RawRunState,
  RunState,
  LogEntry,
  PhaseInfo,
  PhaseStatus,
  PipelineStepState,
  StepStatus,
  AgentInfo,
  AgentTask,
  RunSummary,
  RunDetail,
  ContextFile,
} from '../types.js';
import {
  DEFAULT_BUDGET,
  DEFAULT_MAX_BUDGET_PER_TASK,
  FILE_ENCODING,
  LogAction,
  PER_FILE_TAIL_COUNT,
  PhaseStatusValue,
  RECENT_LOG_COUNT,
  RUN_FILES,
  RunStatusValue,
  StepStatusValue,
  TaskStatusValue,
  ZERO_TOKENS,
} from '../constants.js';

// ─── File Readers ───────────────────────────────────────────────────────────

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, FILE_ENCODING)) as T;
  } catch {
    return null;
  }
}

function readJsonl(filePath: string): LogEntry[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs
      .readFileSync(filePath, FILE_ENCODING)
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) as LogEntry; }
        catch { return null; }
      })
      .filter(Boolean) as LogEntry[];
  } catch {
    return [];
  }
}

// ─── Step / Phase Helpers ───────────────────────────────────────────────────

function humanizeStepId(id: string): string {
  return id
    .split('-')
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/**
 * Map a pipeline step's status to a dashboard phase status. `skipped` is
 * surfaced as its own state so the UI can distinguish it from `done`
 * (e.g. when an earlier phase fails and downstream phases are bypassed).
 */
function phaseStatusFromStep(status: StepStatus | undefined): PhaseStatus {
  if (status === StepStatusValue.Completed) return PhaseStatusValue.Done;
  if (status === StepStatusValue.Skipped) return PhaseStatusValue.Skipped;
  if (status === StepStatusValue.InProgress) return PhaseStatusValue.Running;
  if (status === StepStatusValue.Failed) return PhaseStatusValue.Failed;
  return PhaseStatusValue.Pending;
}

/**
 * Collect tasks from all steps that have subtasks, not just a specific step.
 */
function collectTasks(steps: PipelineStepState[]): AgentTask[] {
  return steps.flatMap((s) => s.tasks ?? []);
}

/**
 * Normalize the on-disk RawRunState into the dashboard-facing RunState.
 * Adds convenience aliases (`tasks`, `startedAt`, `completedAt`) so existing
 * frontend code can stay step-agnostic.
 */
function normalizeRunState(raw: RawRunState): RunState {
  return {
    ticketId: raw.ticketId,
    description: raw.description,
    baseBranch: raw.baseBranch,
    branch: raw.branch,
    worktreePath: raw.worktreePath,
    contextFolder: raw.contextFolder,
    status: raw.status,
    steps: raw.steps ?? [],
    tasks: collectTasks(raw.steps ?? []),
    startedAt: raw.pipelineStartedAt,
    completedAt: raw.pipelineCompletedAt,
    totalCostUsd: raw.totalCostUsd ?? 0,
    totalTokenUsage: raw.totalTokenUsage,
  };
}

// ─── List Runs ──────────────────────────────────────────────────────────────

function getRunStatus(state: RunState, phases: PhaseInfo[]): RunSummary['status'] {
  // Authoritative: the orchestrator's top-level status on tasks.json.
  if (state.status === StepStatusValue.Completed) return RunStatusValue.Completed;
  if (state.status === StepStatusValue.Failed) return RunStatusValue.Failed;
  if (state.status === StepStatusValue.InProgress) return RunStatusValue.Running;

  const taskFailed = state.tasks.some((t) => t.status === TaskStatusValue.Failed);
  const phaseFailed = phases.some((p) => p.status === PhaseStatusValue.Failed);
  if (taskFailed || phaseFailed) return RunStatusValue.Failed;

  if (state.completedAt) return RunStatusValue.Completed;

  const phaseRunning = phases.some((p) => p.status === PhaseStatusValue.Running);
  const taskRunning = state.tasks.some((t) => t.status === TaskStatusValue.InProgress);
  if (taskRunning || phaseRunning) return RunStatusValue.Running;

  const allPhasesDone =
    phases.length > 0 && phases.every((p) => p.status === PhaseStatusValue.Done);
  if (allPhasesDone) return RunStatusValue.Completed;

  const hasAny =
    state.tasks.some((t) => t.status !== TaskStatusValue.Pending) ||
    phases.some((p) => p.status !== PhaseStatusValue.Pending);
  return hasAny ? RunStatusValue.Running : RunStatusValue.Pending;
}

export function listRuns(runsPath: string): RunSummary[] {
  if (!fs.existsSync(runsPath)) return [];

  const entries = fs.readdirSync(runsPath, { withFileTypes: true });
  const runs: RunSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(runsPath, entry.name);
    const raw = readJson<RawRunState>(path.join(runDir, RUN_FILES.tasks));
    if (!raw) continue;

    const state = normalizeRunState(raw);
    const phases = buildPhases(state);
    runs.push({
      ticketId: state.ticketId,
      description: state.description,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      totalCostUsd: state.totalCostUsd,
      taskCount: state.tasks.length,
      completedCount: state.tasks.filter((t) => t.status === TaskStatusValue.Completed).length,
      failedCount: state.tasks.filter((t) => t.status === TaskStatusValue.Failed).length,
      status: getRunStatus(state, phases),
    });
  }

  runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return runs;
}

// ─── Run Detail ─────────────────────────────────────────────────────────────

function listLogFiles(logsDir: string): string[] {
  if (!fs.existsSync(logsDir)) return [];
  try {
    return fs
      .readdirSync(logsDir)
      .filter((f) => f.endsWith(RUN_FILES.jsonlExt))
      .map((f) => path.join(logsDir, f));
  } catch {
    return [];
  }
}

/**
 * Build the dashboard phase list. Every phase — including `git-setup` — comes
 * from `tasks.json` `steps[]` so completion is decided by a single rule:
 * `step.status` mapped through `phaseStatusFromStep`. Logs are not consulted.
 */
function buildPhases(state: RunState, modelMap?: Map<string, string>): PhaseInfo[] {
  return state.steps.map((step, idx) => ({
    id: idx + 1,
    label: humanizeStepId(step.id),
    status: phaseStatusFromStep(step.status),
    stepId: step.id,
    model: modelMap?.get(step.id),
  }));
}

// ─── Pipeline Config ───────────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  model?: string;
}

interface PipelineConfig {
  steps: PipelineStep[];
}

/** Read pipeline.json from the parent of the runs directory and build a stepId -> model map. */
function readPipelineConfig(runsPath: string): Map<string, string> {
  const pipelinePath = path.join(runsPath, '..', 'pipeline.json');
  const config = readJson<PipelineConfig>(pipelinePath);
  const modelMap = new Map<string, string>();
  if (!config?.steps) return modelMap;
  for (const step of config.steps) {
    if (step.model) {
      modelMap.set(step.id, step.model);
    }
  }
  return modelMap;
}

function buildAgents(steps: PipelineStepState[]): AgentInfo[] {
  return steps.map((step) => ({
    name: step.id,
    tokenUsage: step.tokenUsage ?? { ...ZERO_TOKENS },
  }));
}

function buildRecentLogs(logsDir: string, count: number): LogEntry[] {
  const all: LogEntry[] = [];
  for (const filePath of listLogFiles(logsDir)) {
    all.push(...readJsonl(filePath).slice(-PER_FILE_TAIL_COUNT));
  }
  all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return all.slice(-count);
}

export function getRunDetail(runsPath: string, ticketId: string): RunDetail | null {
  const runDir = path.join(runsPath, ticketId);
  if (!fs.existsSync(runDir)) return null;

  const raw = readJson<RawRunState>(path.join(runDir, RUN_FILES.tasks));
  if (!raw) return null;

  let state = normalizeRunState(raw);

  const modelMap = readPipelineConfig(runsPath);
  const phases = buildPhases(state, modelMap);

  // Reconcile state.status with phase progress. The orchestrator writes
  // tasks.json in batches and its top-level status can lag behind per-phase
  // transitions — notably for phases with no subtasks, where there are no
  // task-level signals to fall back on. Promoting pending → in_progress here
  // keeps the dashboard header, polling, and badges in sync with what the
  // phases already show.
  const rawStatusActive =
    state.status === StepStatusValue.Completed ||
    state.status === StepStatusValue.Failed ||
    state.status === StepStatusValue.InProgress;
  if (!rawStatusActive && phases.some((p) => p.status === PhaseStatusValue.Running)) {
    state = { ...state, status: StepStatusValue.InProgress };
  }

  const logsDir = path.join(runDir, RUN_FILES.logsDir);
  return {
    state,
    phases,
    agents: buildAgents(state.steps),
    recentLogs: buildRecentLogs(logsDir, RECENT_LOG_COUNT),
    totalBudget: raw.totalBudgetUsd ?? DEFAULT_BUDGET,
    maxBudgetPerTask: raw.maxBudgetPerTaskUsd ?? DEFAULT_MAX_BUDGET_PER_TASK,
  };
}

// ─── Task / Phase Logs ──────────────────────────────────────────────────────

function withFullCompleteMessage(entries: LogEntry[], fullResult: string | undefined): LogEntry[] {
  if (!fullResult) return entries;
  return entries.map((e) =>
    e.action === LogAction.Complete ? { ...e, message: fullResult } : e
  );
}

function readTasksJson(runsPath: string, ticketId: string): RawRunState | null {
  return readJson<RawRunState>(path.join(runsPath, ticketId, RUN_FILES.tasks));
}

export function getTaskLogs(runsPath: string, ticketId: string, taskId: string): LogEntry[] {
  const logFile = path.join(
    runsPath,
    ticketId,
    RUN_FILES.logsDir,
    `${RUN_FILES.workerLogPrefix}${taskId}${RUN_FILES.jsonlExt}`
  );
  const entries = readJsonl(logFile);
  const raw = readTasksJson(runsPath, ticketId);
  const task = raw?.steps
    ?.flatMap((s) => s.tasks ?? [])
    .find((t) => t.id === taskId);
  return withFullCompleteMessage(entries, task?.result);
}

// ─── Context Files ──────────────────────────────────────────────────────────

function getContextFolder(runsPath: string, ticketId: string): string | null {
  const raw = readTasksJson(runsPath, ticketId);
  const folder = raw?.contextFolder;
  if (!folder) return null;
  const absolute = path.resolve(folder);
  if (fs.existsSync(absolute)) return absolute;
  // Fallback: the recorded absolute path may be stale (e.g. the project was
  // moved). Try the conventional sibling of the runs directory.
  const fallback = path.resolve(runsPath, '..', path.basename(path.dirname(folder.replace(/\/$/, ''))), ticketId);
  if (fs.existsSync(fallback)) return fallback;
  const simpleFallback = path.resolve(runsPath, '..', 'gather', ticketId);
  if (fs.existsSync(simpleFallback)) return simpleFallback;
  return absolute;
}

function walkFiles(root: string, dir: string, out: ContextFile[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(root, full, out);
    } else if (entry.isFile()) {
      const rel = path.relative(root, full);
      let sizeBytes = 0;
      try { sizeBytes = fs.statSync(full).size; } catch { /* ignore */ }
      out.push({ name: entry.name, relativePath: rel, sizeBytes });
    }
  }
}

export function listContextFiles(runsPath: string, ticketId: string): ContextFile[] {
  const folder = getContextFolder(runsPath, ticketId);
  if (!folder || !fs.existsSync(folder)) return [];
  const files: ContextFile[] = [];
  walkFiles(folder, folder, files);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

export function readContextFile(
  runsPath: string,
  ticketId: string,
  relativePath: string
): string | null {
  const folder = getContextFolder(runsPath, ticketId);
  if (!folder) return null;
  const resolved = path.resolve(folder, relativePath);
  const rel = path.relative(folder, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  try {
    return fs.readFileSync(resolved, FILE_ENCODING);
  } catch {
    return null;
  }
}

export function getPhaseLogs(runsPath: string, ticketId: string, phase: string): LogEntry[] {
  const logFile = path.join(
    runsPath,
    ticketId,
    RUN_FILES.logsDir,
    `${phase}${RUN_FILES.jsonlExt}`
  );
  const entries = readJsonl(logFile);
  const raw = readTasksJson(runsPath, ticketId);
  const step = raw?.steps?.find((s) => s.id === phase);
  return withFullCompleteMessage(entries, step?.result);
}
