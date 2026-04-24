export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
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

export interface RunState {
  ticketId: string;
  description: string;
  baseBranch: string;
  branch: string;
  worktreePath?: string;
  /** Absolute path to the folder of files the planner used as context. */
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

export interface PhaseInfo {
  id: number;
  label: string;
  status: PhaseStatus;
  /** Pipeline step id this phase mirrors. Absent for the synthetic Git Setup phase. */
  stepId?: string;
  /** AI model configured for this phase in pipeline.json. */
  model?: string;
}

export interface AgentInfo {
  name: string;
  tokenUsage: TokenUsage;
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
  /** Per-task spend cap, in USD — used for per-task budget visuals. */
  maxBudgetPerTask: number;
}

export interface ContextFile {
  name: string;
  relativePath: string;
  sizeBytes: number;
}

export interface ContextFileContent {
  relativePath: string;
  content: string;
}

export interface ContextFilePanelProps {
  file: ContextFile;
  content: string | null;
  loading: boolean;
  onClose: () => void;
}

export interface ContextFileTileProps {
  file: ContextFile;
  onSelect: (file: ContextFile) => void;
}

export interface ContextFilesListProps {
  files: ContextFile[];
  onSelect: (file: ContextFile) => void;
}

export interface DirectoryListing {
  current: string;
  parent: string;
  entries: {
    name: string;
    path: string;
    isDirectory: boolean;
  }[];
}

// ─── UI Component Types ────────────────────────────────────────────────────

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export type AccentVariant = 'start' | 'complete';

export type LogTarget =
  | { type: 'task'; taskId: string }
  | { type: 'phase'; phase: string }
  | null;


// ─── Component Props ───────────────────────────────────────────────────────

export interface RunDetailProps {
  projectId: string;
  ticketId: string;
}

export interface LogPanelProps {
  title: string;
  logs: LogEntry[];
  loading: boolean;
  onClose: () => void;
  /** Markdown report produced by the task or step, rendered above the log stream. */
  result?: string;
}

export interface TaskRowProps {
  task: AgentTask;
  maxBudgetPerTask: number;
  onSelect: (taskId: string) => void;
}

export interface PhaseTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  cost: number;
}

export interface TaskAccordionProps {
  phases: PhaseInfo[];
  steps: PipelineStepState[];
  tasks: AgentTask[];
  agents: AgentInfo[];
  maxBudgetPerTask: number;
  onSelectTask: (taskId: string) => void;
  onSelectPhase: (phase: string) => void;
}

export interface StatCardsProps {
  detail: RunDetail;
}

export interface PhaseStepperProps {
  phases: PhaseInfo[];
}

export interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  display?: string;
}

export interface ProjectRunsProps {
  project: Project;
  selectedRun: string | null;
  onSelectRun: (projectId: string, ticketId: string) => void;
  onRemove: (id: string) => void;
}

export interface AppSidebarProps {
  selectedProjectId: string | null;
  selectedRunId: string | null;
  onSelectRun: (projectId: string, ticketId: string) => void;
  onProjectRemoved: (projectId: string) => void;
}

export interface DirectoryBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export interface AddProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, runsPath: string) => void;
}

export interface MarkdownViewerProps {
  content: string;
  className?: string;
}
