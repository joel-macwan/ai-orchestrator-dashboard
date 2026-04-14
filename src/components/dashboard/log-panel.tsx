import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Search,
  FileText,
  Pencil,
  Terminal,
  Globe,
  ChevronRight,
  ChevronDown,
  Play,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import { formatTime, formatCost, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  ACTION_STYLES,
  DEFAULT_ACTION_STYLE,
  LogAction,
  ToolName,
  TOOL_DURATION_MS_THRESHOLD,
} from '@/lib/constants';
import type { LogEntry, AccentVariant, LogPanelProps } from '@/lib/types';

// ─── Action Colors ──────────────────────────────────────────────────────────

function getActionStyle(action: string): string {
  return ACTION_STYLES[action] ?? DEFAULT_ACTION_STYLE;
}

// ─── Tool Icons (Claude Code style) ─────────────────────────────────────────

const TOOL_ICONS: Record<string, React.ElementType> = {
  [ToolName.Glob]: Search,
  [ToolName.Grep]: Search,
  [ToolName.Read]: FileText,
  [ToolName.Edit]: Pencil,
  [ToolName.Write]: Pencil,
  [ToolName.Bash]: Terminal,
  [ToolName.WebFetch]: Globe,
  [ToolName.WebSearch]: Globe,
};

const DEFAULT_TOOL_ICON = Terminal;

function getToolIcon(toolName: string): React.ElementType {
  return TOOL_ICONS[toolName] ?? DEFAULT_TOOL_ICON;
}

// ─── Shared cost badge used across row types ────────────────────────────────

function CostBadge({ costUsd }: { costUsd: number }) {
  if (costUsd <= 0) return null;
  return (
    <span className="text-[10px] text-muted-foreground font-mono">
      +{formatCost(costUsd)}
    </span>
  );
}

// ─── Expand/Collapse chevron ────────────────────────────────────────────────

function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <ChevronRight
      className={cn(
        'h-3 w-3 text-muted-foreground transition-transform shrink-0',
        expanded && 'rotate-90'
      )}
    />
  );
}

// ─── Tool Use Row (Claude Code style) ───────────────────────────────────────

function ToolUseRow({ entry, nextEntry }: { entry: LogEntry; nextEntry?: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = entry.message;
  const Icon = getToolIcon(toolName);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Compute duration to next entry if available
  const durationMs =
    entry.durationMs ??
    (nextEntry
      ? new Date(nextEntry.timestamp).getTime() - new Date(entry.timestamp).getTime()
      : undefined);

  const hasDuration = durationMs != null && durationMs > 0;
  const durationLabel = hasDuration
    ? (durationMs < TOOL_DURATION_MS_THRESHOLD ? `${durationMs}ms` : formatDuration(durationMs))
    : null;

  return (
    <div className="border-l-2 border-chart-2/40 ml-4 py-1 bg-chart-2/10 rounded-r-md">
      <button
        onClick={toggleExpanded}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-r-md',
          'hover:bg-chart-2/15 text-left group'
        )}
      >
        <ExpandChevron expanded={expanded} />
        <Icon className="h-3.5 w-3.5 text-secondary-foreground dark:text-foreground shrink-0" />
        <span className="font-mono text-xs font-medium text-secondary-foreground dark:text-foreground">{toolName}</span>
        {durationLabel && (
          <span className="text-[10px] text-muted-foreground ml-auto font-mono">
            {durationLabel}
          </span>
        )}
        <CostBadge costUsd={entry.tokenUsage?.costUsd ?? 0} />
      </button>
      {expanded && (
        <div className="px-4 py-2 ml-5 text-xs text-muted-foreground font-mono bg-chart-2/20 rounded-md mx-3 mt-1">
          <p>Agent: {entry.agentName}</p>
          <p className="mt-1">Time: {formatTime(entry.timestamp)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Accent Row (start / complete) ──────────────────────────────────────────
// Uses the same compact pill layout as ToolUseRow so start/complete entries
// visually group with the tool stream, just in a different accent color.

const ACCENT_STYLES: Record<
  AccentVariant,
  { border: string; bg: string; hover: string; text: string; expandedBg: string }
> = {
  start: {
    border: 'border-chart-3/40',
    bg: 'bg-chart-3/10',
    hover: 'hover:bg-chart-3/15',
    text: 'text-chart-3',
    expandedBg: 'bg-chart-3/20',
  },
  complete: {
    border: 'border-chart-4/40',
    bg: 'bg-chart-4/10',
    hover: 'hover:bg-chart-4/15',
    text: 'text-chart-4',
    expandedBg: 'bg-chart-4/20',
  },
};

function AccentRow({ entry, variant }: { entry: LogEntry; variant: AccentVariant }) {
  const [expanded, setExpanded] = useState(false);
  const styles = ACCENT_STYLES[variant];
  const Icon = variant === 'start' ? Play : CheckCircle2;

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className={cn('border-l-2 ml-4 py-1 rounded-r-md', styles.border, styles.bg)}>
      <button
        onClick={toggleExpanded}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-r-md text-left group',
          styles.hover
        )}
      >
        <ExpandChevron expanded={expanded} />
        <Icon className={cn('h-3.5 w-3.5 shrink-0', styles.text)} />
        <span className={cn('font-mono text-xs font-medium uppercase', styles.text)}>
          {entry.action}
        </span>
        <span className="text-xs text-muted-foreground truncate">{entry.agentName}</span>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono whitespace-nowrap">
          {formatTime(entry.timestamp)}
        </span>
        <CostBadge costUsd={entry.tokenUsage?.costUsd ?? 0} />
      </button>
      {expanded && (
        <div
          className={cn(
            'px-4 py-2 ml-5 text-xs rounded-md mx-3 mt-1 break-words overflow-x-auto max-w-full min-w-0',
            styles.expandedBg
          )}
        >
          <MarkdownViewer content={entry.message} />
        </div>
      )}
    </div>
  );
}

// ─── Standard Log Entry Row ─────────────────────────────────────────────────

/** Icon and color config for standard (non-tool, non-accent) log entries. */
const STANDARD_LOG_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  [LogAction.Complete]: { icon: CheckCircle2, color: 'text-secondary-foreground dark:text-foreground' },
  [LogAction.SessionEnd]: { icon: CheckCircle2, color: 'text-secondary-foreground dark:text-foreground' },
  [LogAction.Error]: { icon: XCircle, color: 'text-destructive' },
  [LogAction.Start]: { icon: Play, color: 'text-secondary-foreground dark:text-foreground' },
  [LogAction.Git]: { icon: Terminal, color: 'text-primary' },
};

const DEFAULT_LOG_CONFIG = { icon: MessageSquare, color: 'text-muted-foreground' };

function StandardLogRow({ entry }: { entry: LogEntry }) {
  const config = STANDARD_LOG_CONFIG[entry.action] ?? DEFAULT_LOG_CONFIG;
  const StatusIcon = config.icon;

  return (
    <div className="flex gap-3 px-4 py-2.5 text-sm border-b border-border/50 bg-muted/30 hover:bg-accent/50 transition-colors">
      <StatusIcon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] h-5 shrink-0 ${getActionStyle(entry.action)}`}
          >
            {entry.action}
          </Badge>
          <span className="text-xs text-muted-foreground">{entry.agentName}</span>
          <span className="text-xs text-muted-foreground font-mono ml-auto whitespace-nowrap">
            {formatTime(entry.timestamp)}
          </span>
        </div>
        <div className="mt-1 break-words">
          <MarkdownViewer content={entry.message} />
        </div>
      </div>
      <CostBadge costUsd={entry.tokenUsage?.costUsd ?? 0} />
    </div>
  );
}

// ─── Log Entry Row (delegates to ToolUse, Accent, or Standard) ─────────────

function LogRow({ entry, nextEntry }: { entry: LogEntry; nextEntry?: LogEntry }) {
  if (entry.action === LogAction.ToolUse) {
    return <ToolUseRow entry={entry} nextEntry={nextEntry} />;
  }
  if (entry.action === LogAction.Start) {
    return <AccentRow entry={entry} variant="start" />;
  }
  if (entry.action === LogAction.Complete || entry.action === LogAction.SessionEnd) {
    return <AccentRow entry={entry} variant="complete" />;
  }
  return <StandardLogRow entry={entry} />;
}

// ─── Result Section ────────────────────────────────────────────────────────

function ResultSection({ result }: { result: string }) {
  const [expanded, setExpanded] = useState(true);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="border-b border-border">
      <button
        onClick={toggleExpanded}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <FileText className="h-3.5 w-3.5" />
        Result
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-muted/20">
          <MarkdownViewer content={result} />
        </div>
      )}
    </div>
  );
}

// ─── Log Panel ──────────────────────────────────────────────────────────────

export function LogPanel({ title, logs, loading, onClose, result }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasLogs = logs.length > 0;

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="flex h-full flex-col border-l border-border">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-semibold text-sm">Logs</h3>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1 overflow-y-auto">
        {result && <ResultSection result={result} />}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground">Loading logs...</span>
          </div>
        ) : !hasLogs ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground">No logs available</span>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {logs.map((entry, i) => (
              <LogRow
                key={`${entry.timestamp}-${i}`}
                entry={entry}
                nextEntry={logs[i + 1]}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
