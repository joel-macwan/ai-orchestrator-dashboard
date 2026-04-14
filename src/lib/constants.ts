import type { TaskStatus, BadgeVariant } from './types';
import type { RunSummary } from './types';

// ─── API ────────────────────────────────────────────────────────────────────

export const API_BASE = '/api';

export const ApiRoute = {
  Projects: '/projects',
  Runs: '/runs',
  Browse: '/browse',
} as const;

// ─── Polling ────────────────────────────────────────────────────────────────

export const POLL_INTERVAL_MS = 1000;

// ─── Theme ──────────────────────────────────────────────────────────────────

export const THEME_STORAGE_KEY = 'dashboard-theme';
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export const Theme = {
  Light: 'light',
  Dark: 'dark',
} as const;
export type ThemeValue = (typeof Theme)[keyof typeof Theme];

// ─── Responsive ─────────────────────────────────────────────────────────────

export const MOBILE_BREAKPOINT_PX = 768;

// ─── Layout / Panels ────────────────────────────────────────────────────────

export const LOG_PANEL_DEFAULT_SIZE = 45;
export const LOG_PANEL_MIN_SIZE = 25;
export const MAIN_PANEL_DEFAULT_SIZE = 55;
export const MAIN_PANEL_MIN_SIZE = 30;

// ─── Circular Progress ──────────────────────────────────────────────────────

export const CIRCULAR_PROGRESS_DEFAULT_SIZE = 80;
export const CIRCULAR_PROGRESS_DEFAULT_STROKE = 6;
export const STAT_CIRCULAR_SIZE = 88;
export const STAT_CIRCULAR_STROKE = 7;

// ─── Stat Card Colors ───────────────────────────────────────────────────────

export const STAT_COLORS = {
  tasks: 'hsl(142 71% 45%)',
  budget: 'hsl(43 96% 56%)',
  primary: 'hsl(var(--primary))',
  mutedStroke: 'hsl(var(--muted))',
} as const;

// ─── Budget Thresholds ──────────────────────────────────────────────────────

export const BUDGET_THRESHOLD_HIGH = 0.8;
export const BUDGET_THRESHOLD_MID = 0.5;

// ─── Formatting ─────────────────────────────────────────────────────────────

export const COST_SMALL_THRESHOLD = 0.01;
export const COST_DECIMAL_PLACES = 2;
export const COST_SMALL_DECIMAL_PLACES = 4;

export const TOKEN_MILLION = 1_000_000;
export const TOKEN_THOUSAND = 1_000;

export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const MS_PER_MINUTE = 60_000;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;

export const LOCALE = 'en-US';

export const TOOL_DURATION_MS_THRESHOLD = 1000;

// ─── Log Actions ────────────────────────────────────────────────────────────

export const LogAction = {
  Start: 'start',
  ToolUse: 'tool_use',
  Complete: 'complete',
  SessionEnd: 'session_end',
  Error: 'error',
  Config: 'config',
  Git: 'git',
} as const;
export type LogActionValue = (typeof LogAction)[keyof typeof LogAction];

export const ACTION_STYLES: Record<string, string> = {
  [LogAction.Start]: 'bg-chart-3 text-white border-border',
  [LogAction.ToolUse]: 'bg-chart-2 text-black border-border',
  [LogAction.Complete]: 'bg-chart-4 text-black border-border',
  [LogAction.SessionEnd]: 'bg-chart-4 text-black border-border',
  [LogAction.Error]: 'bg-destructive text-destructive-foreground dark:text-white border-border',
  [LogAction.Config]: 'bg-primary text-primary-foreground dark:text-white border-border',
  [LogAction.Git]: 'bg-primary text-primary-foreground dark:text-white border-border',
};

export const DEFAULT_ACTION_STYLE = 'bg-muted text-muted-foreground border-border';

// ─── Tool Names ─────────────────────────────────────────────────────────────

export const ToolName = {
  Glob: 'Glob',
  Grep: 'Grep',
  Read: 'Read',
  Edit: 'Edit',
  Write: 'Write',
  Bash: 'Bash',
  WebFetch: 'WebFetch',
  WebSearch: 'WebSearch',
} as const;

// ─── Phase Accordion ────────────────────────────────────────────────────────

/** Prefix for accordion item values that represent pipeline steps. */
export const STEP_ACCORDION_PREFIX = 'step-';
/** Prefix for accordion item values that represent non-step phases. */
export const PHASE_ACCORDION_PREFIX = 'phase-';

// ─── Run Status Styles ──────────────────────────────────────────────────────

export const RUN_STATUS_BADGE_STYLES: Record<RunSummary['status'], string> = {
  running: 'bg-amber-400 text-black border-border',
  completed: 'bg-chart-4 text-black border-border',
  failed: 'bg-red-500 text-white border-border',
  pending: 'bg-muted text-muted-foreground border-border',
};

export const RUN_STATUS_COLORS: Record<RunSummary['status'], string> = {
  running: 'text-amber-400',
  completed: 'text-chart-4',
  failed: 'text-red-500',
  pending: 'text-muted-foreground',
};

// ─── Task Status Config ─────────────────────────────────────────────────────

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; variant: BadgeVariant; className: string }
> = {
  completed: {
    label: 'Completed',
    variant: 'outline',
    className: 'bg-chart-4 text-black border-border',
  },
  in_progress: {
    label: 'Running',
    variant: 'outline',
    className: 'bg-secondary text-secondary-foreground border-border',
  },
  pending: {
    label: 'Pending',
    variant: 'outline',
    className: 'bg-muted text-muted-foreground border-border',
  },
  failed: {
    label: 'Failed',
    variant: 'outline',
    className: 'bg-destructive text-destructive-foreground dark:text-white border-border',
  },
  blocked: {
    label: 'Blocked',
    variant: 'outline',
    className: 'bg-secondary text-secondary-foreground border-border',
  },
};

export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0,
  pending: 1,
  blocked: 2,
  completed: 3,
  failed: 4,
};

// ─── Phase Status Styles ────────────────────────────────────────────────────

export const PHASE_STATUS_ICON_STYLES: Record<string, string> = {
  done: 'text-chart-4',
  running: 'text-amber-400 animate-spin',
  pending: 'text-muted-foreground',
  failed: 'text-red-500',
  skipped: 'text-muted-foreground',
};

export const PHASE_STATUS_BADGE_STYLES: Record<string, string> = {
  done: 'bg-chart-4 text-black border-border',
  running: 'bg-amber-400 text-black border-border',
  failed: 'bg-red-500 text-white border-border',
  pending: 'bg-muted text-muted-foreground border-border',
  skipped: 'bg-muted text-muted-foreground border-border',
};

// ─── Run Status Header Styles ───────────────────────────────────────────────

export const RUN_HEADER_STATUS_STYLES: Record<string, string> = {
  running: 'bg-amber-400 text-black border-border',
  completed: 'bg-chart-4 text-black border-border',
  failed: 'bg-red-500 text-white border-border',
  pending: 'bg-muted text-muted-foreground border-border',
};

// ─── Phase Status → Task Status ─────────────────────────────────────────────

export const PHASE_TO_TASK_STATUS: Record<string, TaskStatus> = {
  done: 'completed',
  running: 'in_progress',
  pending: 'pending',
  failed: 'failed',
  skipped: 'pending',
};

// ─── Recent Logs Display ────────────────────────────────────────────────────

export const RECENT_LOG_TAIL = 20;
