export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

export type StepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  steps: string[];
  status: TaskStatus;
  dependsOn: string[];
  blockedBy: string[];
  assignedAgent?: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  tokenUsage?: TokenUsage;
}

/**
 * Lifecycle of a single pipeline step (planner, implementation, test-writer,
 * codacy-checker, reviewer, …). Steps that fan out into subtasks (currently
 * just `implementation`) own them inline via `tasks`.
 */
export interface PipelineStepState {
  id: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  tokenUsage?: TokenUsage;
  result?: string;
  tasks?: AgentTask[];
}

/**
 * Raw shape of `tasks.json` written by the agent loop.
 */
export interface RawRunState {
  ticketId: string;
  description: string;
  baseBranch: string;
  branch: string;
  worktreePath?: string;
  /** Absolute path to the folder of files the planner used as context. */
  contextFolder?: string;
  /** Overall loop status written by the orchestrator. */
  status?: StepStatus;
  pipelineStartedAt: string;
  pipelineCompletedAt?: string;
  totalCostUsd: number;
  totalTokenUsage?: TokenUsage;
  steps: PipelineStepState[];
}

/**
 * Normalized run state served to the dashboard. Carries both the new
 * step-oriented fields and convenience aliases (`tasks`, `startedAt`,
 * `completedAt`) so existing UI code keeps working.
 */
export interface RunState {
  ticketId: string;
  description: string;
  baseBranch: string;
  branch: string;
  worktreePath?: string;
  contextFolder?: string;
  /** Overall loop status from the orchestrator (authoritative). */
  status?: StepStatus;
  tasks: AgentTask[];
  steps: PipelineStepState[];
  startedAt: string;
  completedAt?: string;
  totalCostUsd: number;
  totalTokenUsage?: TokenUsage;
}

export interface LogEntry {
  timestamp: string;
  agentName: string;
  taskId?: string;
  action: string;
  message: string;
  tokenUsage?: TokenUsage;
  durationMs?: number;
}

export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PhaseInfo {
  id: number;
  label: string;
  status: PhaseStatus;
  stepId?: string;
  /** AI model configured for this phase in pipeline.json. */
  model?: string;
}

export interface AgentInfo {
  name: string;
  status: 'running' | 'done' | 'failed' | 'pending';
  tokenUsage: TokenUsage;
  lastAction: string;
  lastMessage: string;
  lastTimestamp: string;
  durationMs: number;
  taskId?: string;
}

export interface Project {
  id: string;
  name: string;
  runsPath: string;
  addedAt: string;
}

export interface RunSummary {
  ticketId: string;
  description: string;
  startedAt: string;
  completedAt?: string;
  totalCostUsd: number;
  taskCount: number;
  completedCount: number;
  failedCount: number;
  status: 'running' | 'completed' | 'failed' | 'pending';
}

export interface RunDetail {
  state: RunState;
  phases: PhaseInfo[];
  agents: AgentInfo[];
  recentLogs: LogEntry[];
  totalBudget: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface ContextFile {
  name: string;
  relativePath: string;
  sizeBytes: number;
}
