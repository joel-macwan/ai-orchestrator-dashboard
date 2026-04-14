import { useState, useCallback, useMemo } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCards } from './stat-cards';
import { PhaseStepper } from './phase-stepper';
import { TaskAccordion } from './task-accordion';
import { LogPanel } from './log-panel';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import { usePolling } from '@/hooks/use-polling';
import { fetchRunDetail, fetchTaskLogs, fetchPhaseLogs } from '@/lib/api';
import { RUN_HEADER_STATUS_STYLES } from '@/lib/constants';
import { capitalize } from '@/lib/format';
import type { LogEntry, RunDetailProps, LogTarget, RunState } from '@/lib/types';
import { GitBranch, Loader2 } from 'lucide-react';

// ─── Section Title (shared style for card headers) ─────────────────────────

const SECTION_TITLE_CLASSES = 'text-sm font-medium uppercase tracking-wider text-muted-foreground';

// ─── Run Status Helpers ────────────────────────────────────────────────────

/** Derive the overall run status from the run state. */
function deriveRunStatus(state: RunState): string {
  // Authoritative: orchestrator's top-level status on tasks.json.
  if (state.status === 'completed') return 'completed';
  if (state.status === 'failed') return 'failed';
  if (state.status === 'in_progress') return 'running';

  const hasFailed = state.tasks.some((t) => t.status === 'failed');
  if (state.completedAt) {
    return hasFailed ? 'failed' : 'completed';
  }
  const hasInProgress = state.tasks.some((t) => t.status === 'in_progress');
  return hasInProgress ? 'running' : 'pending';
}

// ─── Run Detail ────────────────────────────────────────────────────────────

export function RunDetail({ projectId, ticketId }: RunDetailProps) {
  const [logTarget, setLogTarget] = useState<LogTarget>(null);

  // Fetch run detail with polling
  const fetcher = useCallback(
    () => fetchRunDetail(projectId, ticketId),
    [projectId, ticketId]
  );
  const { data: detail, loading, error } = usePolling(fetcher);

  // Fetch logs for the selected task/phase
  const logsFetcher = useCallback((): Promise<LogEntry[]> => {
    if (!logTarget) return Promise.resolve([]);
    if (logTarget.type === 'task') {
      return fetchTaskLogs(projectId, ticketId, logTarget.taskId);
    }
    return fetchPhaseLogs(projectId, ticketId, logTarget.phase);
  }, [projectId, ticketId, logTarget]);

  const isLogPanelOpen = logTarget !== null;

  const { data: polledLogs, loading: logsLoading } = usePolling(
    logsFetcher,
    isLogPanelOpen
  );
  const logs = polledLogs ?? [];

  // Log panel handlers
  const loadTaskLogs = useCallback((taskId: string) => {
    setLogTarget({ type: 'task', taskId });
  }, []);

  const loadPhaseLogs = useCallback((phase: string) => {
    setLogTarget({ type: 'phase', phase });
  }, []);

  const closeLogs = useCallback(() => {
    setLogTarget(null);
  }, []);

  const handleSheetChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      closeLogs();
    }
  }, [closeLogs]);

  // Derived log panel metadata
  const logTitle = useMemo(() => {
    if (!logTarget) return '';
    if (logTarget.type === 'task') {
      return `Task: ${logTarget.taskId}`;
    }
    return `Phase: ${logTarget.phase}`;
  }, [logTarget]);

  const logResult = useMemo(() => {
    if (!logTarget || !detail) return undefined;
    if (logTarget.type === 'task') {
      return detail.state.tasks.find((t) => t.id === logTarget.taskId)?.result;
    }
    return detail.state.steps.find((s) => s.id === logTarget.phase)?.result;
  }, [logTarget, detail]);

  // ─── Loading / Error / Not Found states ────────────────────────────────

  if (loading && !detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading run details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-destructive">{error}</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-destructive">Run not found</span>
      </div>
    );
  }

  // ─── Derived state ────────────────────────────────────────────────────

  const runStatus = deriveRunStatus(detail.state);
  const isRunning = runStatus === 'running';
  const statusStyle = RUN_HEADER_STATUS_STYLES[runStatus] ?? '';

  // ─── Render ───────────────────────────────────────────────────────────

  const mainContent = (
    <div className="flex flex-col gap-6 p-6">
      {/* Run header: ticket ID, status badge, description, branch info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{detail.state.ticketId}</h2>
          <Badge variant="outline" className={`text-xs ${statusStyle}`}>
            {isRunning && (
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            )}
            {isRunning ? 'Running' : capitalize(runStatus)}
          </Badge>
        </div>
        <MarkdownViewer
          content={detail.state.description}
          className="text-muted-foreground w-1/2"
        />
        {detail.state.branch && (
          <div className="flex items-center gap-1.5 mt-4">
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-sm font-sans gap-1.5 py-1 px-3">
              <GitBranch className="h-3.5 w-3.5" />
              {detail.state.branch}
              {detail.state.baseBranch && (
                <span className="text-muted-foreground/60"> from {detail.state.baseBranch}</span>
              )}
            </Badge>
          </div>
        )}
      </div>

      {/* Summary stat cards */}
      <StatCards detail={detail} />

      {/* Pipeline progress stepper */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={SECTION_TITLE_CLASSES}>Pipeline Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <PhaseStepper phases={detail.phases} />
        </CardContent>
      </Card>

      {/* Tasks grouped by phase */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={SECTION_TITLE_CLASSES}>Tasks by Phase</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <TaskAccordion
            phases={detail.phases}
            steps={detail.state.steps}
            tasks={detail.state.tasks}
            agents={detail.agents}
            onSelectTask={loadTaskLogs}
            onSelectPhase={loadPhaseLogs}
          />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <div className="h-full overflow-y-auto">{mainContent}</div>

      {/* Slide-out log panel */}
      <Sheet open={isLogPanelOpen} onOpenChange={handleSheetChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full p-0 data-[side=right]:sm:max-w-4xl"
        >
          <LogPanel
            title={logTitle}
            logs={logs}
            loading={logsLoading}
            onClose={closeLogs}
            result={logResult}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
