import fs from 'node:fs';
import path from 'node:path';
import type {
  RawRunState,
  RunState,
  LogEntry,
  TokenUsage,
  PhaseInfo,
  PhaseStatus,
  PipelineStepState,
  StepStatus,
  AgentInfo,
  AgentTask,
  RunSummary,
  RunDetail,
} from '../types.js';
import {
  AGENT_STATUS_ORDER,
  DEFAULT_BASE_BRANCH,
  DEFAULT_BUDGET,
  DEFAULT_DESCRIPTION,
  FILE_ENCODING,
  GIT_BRANCH_PATTERN,
  GIT_SETUP_LABEL,
  GIT_SETUP_PHASE_ID,
  LogAction,
  ORCHESTRATOR_AGENT,
  ORCHESTRATOR_LOG_FILE,
  ORCHESTRATOR_START_PREFIX_PATTERN,
  PER_FILE_TAIL_COUNT,
  RECENT_LOG_COUNT,
  RUN_FILES,
  TICKET_BRANCH_PREFIX,
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

// ─── Token Aggregation ──────────────────────────────────────────────────────

function sumTokens(entries: LogEntry[]): TokenUsage {
  return entries.reduce((acc, e) => {
    if (!e.tokenUsage) return acc;
    return {
      inputTokens: acc.inputTokens + e.tokenUsage.inputTokens,
      outputTokens: acc.outputTokens + e.tokenUsage.outputTokens,
      costUsd: acc.costUsd + e.tokenUsage.costUsd,
    };
  }, { ...ZERO_TOKENS });
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
  if (status === 'completed') return 'done';
  if (status === 'skipped') return 'skipped';
  if (status === 'in_progress') return 'running';
  if (status === 'failed') return 'failed';
  return 'pending';
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
    steps: raw.steps ?? [],
    tasks: collectTasks(raw.steps ?? []),
    startedAt: raw.pipelineStartedAt,
    completedAt: raw.pipelineCompletedAt,
    totalCostUsd: raw.totalCostUsd ?? 0,
  };
}

// ─── List Runs ──────────────────────────────────────────────────────────────

function getRunStatus(state: RunState, phases: PhaseInfo[]): RunSummary['status'] {
  const taskFailed = state.tasks.some((t) => t.status === 'failed');
  const phaseFailed = phases.some((p) => p.status === 'failed');
  if (taskFailed || phaseFailed) return 'failed';

  if (state.completedAt) return 'completed';

  const phaseRunning = phases.some((p) => p.status === 'running');
  const taskRunning = state.tasks.some((t) => t.status === 'in_progress');
  if (taskRunning || phaseRunning) return 'running';

  const allPhasesDone = phases.length > 0 && phases.every((p) => p.status === 'done');
  if (allPhasesDone) return 'completed';

  const hasAny =
    state.tasks.some((t) => t.status !== 'pending') ||
    phases.some((p) => p.status !== 'pending');
  return hasAny ? 'running' : 'pending';
}

function inferRunSummaryFromLogs(ticketId: string, logsDir: string): RunSummary | null {
  const logFiles = listLogFiles(logsDir);
  if (logFiles.length === 0 && !fs.existsSync(logsDir)) return null;

  let earliest = '';
  let latest = '';
  let totalCost = 0;
  let hasError = false;
  let description = '';

  for (const filePath of logFiles) {
    const entries = readJsonl(filePath);
    for (const e of entries) {
      if (!earliest || e.timestamp < earliest) earliest = e.timestamp;
      if (!latest || e.timestamp > latest) latest = e.timestamp;
      if (e.tokenUsage) totalCost += e.tokenUsage.costUsd;
      if (e.action === LogAction.Error) hasError = true;
      if (e.action === LogAction.Start && e.agentName === ORCHESTRATOR_AGENT) {
        description = e.message.replace(ORCHESTRATOR_START_PREFIX_PATTERN, '').trim();
      }
      if (e.action === LogAction.Config && e.agentName === ORCHESTRATOR_AGENT && !description) {
        try {
          const config = JSON.parse(e.message);
          if (config.targetCwd) description = `Initializing in ${path.basename(config.targetCwd)}`;
        } catch { /* ignore */ }
      }
    }
  }

  const status: RunSummary['status'] = hasError
    ? 'failed'
    : logFiles.length === 0
      ? 'pending'
      : 'running';

  return {
    ticketId,
    description: description || DEFAULT_DESCRIPTION,
    startedAt: earliest || new Date().toISOString(),
    completedAt: undefined,
    totalCostUsd: totalCost,
    taskCount: 0,
    completedCount: 0,
    failedCount: 0,
    status,
  };
}

export function listRuns(runsPath: string): RunSummary[] {
  if (!fs.existsSync(runsPath)) return [];

  const entries = fs.readdirSync(runsPath, { withFileTypes: true });
  const runs: RunSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(runsPath, entry.name);
    const raw = readJson<RawRunState>(path.join(runDir, RUN_FILES.tasks));

    if (raw) {
      const state = normalizeRunState(raw);
      const logsDir = path.join(runDir, RUN_FILES.logsDir);
      const phases = buildPhases(state, logsDir);
      runs.push({
        ticketId: state.ticketId,
        description: state.description,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        totalCostUsd: state.totalCostUsd,
        taskCount: state.tasks.length,
        completedCount: state.tasks.filter((t) => t.status === 'completed').length,
        failedCount: state.tasks.filter((t) => t.status === 'failed').length,
        status: getRunStatus(state, phases),
      });
    } else {
      const logsDir = path.join(runDir, RUN_FILES.logsDir);
      const summary = inferRunSummaryFromLogs(entry.name, logsDir);
      if (summary) runs.push(summary);
    }
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

function hasAction(entries: LogEntry[], ...actions: string[]): boolean {
  return entries.some((e) => actions.includes(e.action));
}

/**
 * Build the dashboard phase list. Phase 1 is always Git Setup (derived from
 * the orchestrator log). Phases 2..N mirror whatever steps appear in
 * tasks.json so the dashboard stays in sync with pipeline.json without
 * having to duplicate it.
 */
function buildPhases(state: RunState | null, logsDir: string, modelMap?: Map<string, string>): PhaseInfo[] {
  const orchEntries = readJsonl(path.join(logsDir, ORCHESTRATOR_LOG_FILE));
  const gitDone = orchEntries.some((e) => e.action === LogAction.Git);
  const gitRunning = orchEntries.length > 0 && !gitDone;

  const phases: PhaseInfo[] = [
    {
      id: GIT_SETUP_PHASE_ID,
      label: GIT_SETUP_LABEL,
      status: gitDone ? 'done' : gitRunning ? 'running' : 'pending',
    },
  ];

  const steps = state?.steps ?? [];
  steps.forEach((step, idx) => {
    phases.push({
      id: idx + 2,
      label: humanizeStepId(step.id),
      status: phaseStatusFromStep(step.status),
      stepId: step.id,
      model: modelMap?.get(step.id),
    });
  });

  return phases;
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

function buildAgents(logsDir: string): AgentInfo[] {
  const agents: AgentInfo[] = [];

  for (const filePath of listLogFiles(logsDir)) {
    const name = path.basename(filePath, RUN_FILES.jsonlExt);
    if (name === ORCHESTRATOR_AGENT) continue;

    const entries = readJsonl(filePath);
    if (entries.length === 0) continue;

    const last = entries[entries.length - 1]!;
    const first = entries[0]!;
    const tokenUsage = sumTokens(entries);
    const isSessionDone = hasAction(entries, LogAction.SessionEnd, LogAction.Complete);
    const isError = last.action === LogAction.Error && !isSessionDone;

    const status: AgentInfo['status'] = isError ? 'failed' : isSessionDone ? 'done' : 'running';

    const startTs = new Date(first.timestamp).getTime();
    const endTs = new Date(last.timestamp).getTime();
    const durationMs = !isNaN(startTs) && !isNaN(endTs) && endTs > startTs ? endTs - startTs : 0;

    agents.push({
      name,
      status,
      tokenUsage,
      lastAction: last.action,
      lastMessage: last.message ?? '',
      lastTimestamp: last.timestamp ?? '',
      durationMs,
      taskId: last.taskId,
    });
  }

  agents.sort((a, b) => AGENT_STATUS_ORDER[a.status]! - AGENT_STATUS_ORDER[b.status]!);
  return agents;
}

function buildRecentLogs(logsDir: string, count: number): LogEntry[] {
  const all: LogEntry[] = [];
  for (const filePath of listLogFiles(logsDir)) {
    all.push(...readJsonl(filePath).slice(-PER_FILE_TAIL_COUNT));
  }
  all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return all.slice(-count);
}

function synthesizeRawState(ticketId: string, logsDir: string): RawRunState {
  const orchEntries = readJsonl(path.join(logsDir, ORCHESTRATOR_LOG_FILE));
  let branch = '';
  let baseBranch = '';
  let description = '';

  for (const e of orchEntries) {
    if (e.action === LogAction.Git && e.message.includes('branch')) {
      const match = e.message.match(GIT_BRANCH_PATTERN);
      if (match) {
        branch = match[1]!;
        baseBranch = match[2]!;
      }
    }
    if (e.action === LogAction.Start) {
      description = e.message.replace(ORCHESTRATOR_START_PREFIX_PATTERN, '').trim();
    }
  }

  let startedAt = '';
  for (const filePath of listLogFiles(logsDir)) {
    const entries = readJsonl(filePath);
    if (entries.length > 0 && (!startedAt || entries[0]!.timestamp < startedAt)) {
      startedAt = entries[0]!.timestamp;
    }
  }

  return {
    ticketId,
    description: description || DEFAULT_DESCRIPTION,
    baseBranch: baseBranch || DEFAULT_BASE_BRANCH,
    branch: branch || `${TICKET_BRANCH_PREFIX}${ticketId}`,
    pipelineStartedAt: startedAt || new Date().toISOString(),
    totalCostUsd: 0,
    steps: [],
  };
}

export function getRunDetail(runsPath: string, ticketId: string): RunDetail | null {
  const runDir = path.join(runsPath, ticketId);
  if (!fs.existsSync(runDir)) return null;

  const logsDir = path.join(runDir, RUN_FILES.logsDir);
  const raw =
    readJson<RawRunState>(path.join(runDir, RUN_FILES.tasks)) ??
    synthesizeRawState(ticketId, logsDir);

  let state = normalizeRunState(raw);

  // Recompute total cost from all log files so the headline number includes
  // post-implementation phases (state.totalCostUsd persisted by the agent
  // loop only covers worker tasks).
  let totalFromLogs = 0;
  let latestLogTs = '';
  for (const filePath of listLogFiles(logsDir)) {
    for (const e of readJsonl(filePath)) {
      if (e.tokenUsage) totalFromLogs += e.tokenUsage.costUsd;
      if (e.timestamp && e.timestamp > latestLogTs) latestLogTs = e.timestamp;
    }
  }
  state = { ...state, totalCostUsd: totalFromLogs };

  const modelMap = readPipelineConfig(runsPath);
  const phases = buildPhases(state, logsDir, modelMap);

  // If every phase is terminal but the run never wrote pipelineCompletedAt,
  // synthesize one from the latest log timestamp so the UI stops ticking.
  const allTerminal =
    phases.length > 0 && phases.every((p) => p.status === 'done' || p.status === 'failed');
  if (allTerminal && !state.completedAt && latestLogTs) {
    state = { ...state, completedAt: latestLogTs };
  }

  return {
    state,
    phases,
    agents: buildAgents(logsDir),
    recentLogs: buildRecentLogs(logsDir, RECENT_LOG_COUNT),
    totalBudget: DEFAULT_BUDGET,
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
