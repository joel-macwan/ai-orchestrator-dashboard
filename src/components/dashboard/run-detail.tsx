import { useState, useCallback, useMemo, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCards } from './stat-cards';
import { PhaseStepper } from './phase-stepper';
import { TaskAccordion } from './task-accordion';
import { LogPanel } from './log-panel';
import { ContextFilePanel } from './context-file-panel';
import { ContextFilesList } from './context-files-list';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import { usePolling } from '@/hooks/use-polling';
import {
  fetchRunDetail,
  fetchTaskLogs,
  fetchPhaseLogs,
  fetchContextFiles,
  fetchContextFileContent,
} from '@/lib/api';
import type { ContextFile } from '@/lib/types';
import {
  LogTargetType,
  RUN_HEADER_STATUS_STYLES,
  RunStatusValue,
  StepStatusValue,
  TaskStatusValue,
} from '@/lib/constants';
import { capitalize } from '@/lib/format';
import type { LogEntry, RunDetailProps, LogTarget, RunState } from '@/lib/types';
import { GitBranch, Loader2 } from 'lucide-react';

const EMPTY_LOGS: LogEntry[] = [];

// ─── Section Title (shared style for card headers) ─────────────────────────

const SECTION_TITLE_CLASSES = 'text-sm font-medium uppercase tracking-wider text-muted-foreground';

// ─── Run Status Helpers ────────────────────────────────────────────────────

/** Derive the overall run status from the run state. */
function deriveRunStatus(state: RunState): string {
  // Authoritative: orchestrator's top-level status on tasks.json.
  if (state.status === StepStatusValue.Completed) return RunStatusValue.Completed;
  if (state.status === StepStatusValue.Failed) return RunStatusValue.Failed;
  if (state.status === StepStatusValue.InProgress) return RunStatusValue.Running;

  const hasFailed = state.tasks.some((t) => t.status === TaskStatusValue.Failed);
  if (state.completedAt) {
    return hasFailed ? RunStatusValue.Failed : RunStatusValue.Completed;
  }
  const hasInProgress = state.tasks.some((t) => t.status === TaskStatusValue.InProgress);
  return hasInProgress ? RunStatusValue.Running : RunStatusValue.Pending;
}

// ─── Run Detail ────────────────────────────────────────────────────────────

export function RunDetail({ projectId, ticketId }: RunDetailProps) {
  const [logTarget, setLogTarget] = useState<LogTarget>(null);
  const [selectedContextFile, setSelectedContextFile] = useState<ContextFile | null>(null);
  const [contextFileContent, setContextFileContent] = useState<string | null>(null);
  const [contextFileLoading, setContextFileLoading] = useState(false);

  // Fetch run detail with polling
  const fetcher = useCallback(
    () => fetchRunDetail(projectId, ticketId),
    [projectId, ticketId]
  );
  // We need an initial poll even for terminal runs, so enable stays true
  // until the first payload arrives. After that, disable polling once the
  // orchestrator reports a terminal status to avoid pointless background work.
  const [detailPollEnabled, setDetailPollEnabled] = useState(true);
  const { data: detail, loading, error } = usePolling(fetcher, detailPollEnabled);
  const isInProgress = detail?.state.status === StepStatusValue.InProgress;
  useEffect(() => {
    if (detail) setDetailPollEnabled(isInProgress);
  }, [detail, isInProgress]);

  // Fetch logs for the selected task/phase
  const logsFetcher = useCallback((): Promise<LogEntry[]> => {
    if (!logTarget) return Promise.resolve([]);
    if (logTarget.type === LogTargetType.Task) {
      return fetchTaskLogs(projectId, ticketId, logTarget.taskId);
    }
    return fetchPhaseLogs(projectId, ticketId, logTarget.phase);
  }, [projectId, ticketId, logTarget]);

  const isLogPanelOpen = logTarget !== null;
  const isContextPanelOpen = selectedContextFile !== null;

  // Fetch list of context files
  const contextFilesFetcher = useCallback(
    () => fetchContextFiles(projectId, ticketId),
    [projectId, ticketId]
  );
  const { data: contextFiles } = usePolling(contextFilesFetcher, isInProgress);

  // Load selected context file content
  useEffect(() => {
    if (!selectedContextFile) {
      setContextFileContent(null);
      return;
    }
    let cancelled = false;
    setContextFileLoading(true);
    fetchContextFileContent(projectId, ticketId, selectedContextFile.relativePath)
      .then((res) => {
        if (!cancelled) setContextFileContent(res.content);
      })
      .catch(() => {
        if (!cancelled) setContextFileContent(null);
      })
      .finally(() => {
        if (!cancelled) setContextFileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, ticketId, selectedContextFile]);

  const openContextFile = useCallback((file: ContextFile) => {
    setSelectedContextFile(file);
  }, []);

  const closeContextFile = useCallback(() => {
    setSelectedContextFile(null);
  }, []);

  const handleContextSheetChange = useCallback((isOpen: boolean) => {
    if (!isOpen) closeContextFile();
  }, [closeContextFile]);

  const { data: polledLogs, loading: logsLoading } = usePolling(
    logsFetcher,
    isLogPanelOpen && isInProgress
  );
  const logs = polledLogs ?? EMPTY_LOGS;

  // Log panel handlers
  const loadTaskLogs = useCallback((taskId: string) => {
    setLogTarget({ type: LogTargetType.Task, taskId });
  }, []);

  const loadPhaseLogs = useCallback((phase: string) => {
    setLogTarget({ type: LogTargetType.Phase, phase });
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
    if (logTarget.type === LogTargetType.Task) {
      return `Task: ${logTarget.taskId}`;
    }
    return `Phase: ${logTarget.phase}`;
  }, [logTarget]);

  const logResult = useMemo(() => {
    if (!logTarget || !detail) return undefined;
    if (logTarget.type === LogTargetType.Task) {
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

  // Compute all derived values up-front so JSX has no inline conditionals.
  const runStatus = deriveRunStatus(detail.state);
  const isRunning = runStatus === RunStatusValue.Running;
  const statusStyle = RUN_HEADER_STATUS_STYLES[runStatus] ?? '';
  const statusBadgeClassName = `text-xs ${statusStyle}`;
  const statusLabel = isRunning ? 'Running' : capitalize(runStatus);

  // ─── Render ───────────────────────────────────────────────────────────

  const mainContent = (
    <div className="flex flex-col gap-6 p-6">
      {/* Run header: ticket ID, status badge, description, branch info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{detail.state.ticketId}</h2>
          <Badge variant="outline" className={statusBadgeClassName}>
            {/* Pulsing dot is only shown while the run is actively running. */}
            {isRunning && (
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            )}
            {statusLabel}
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

      {/* Planner context files */}
      {contextFiles && contextFiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className={SECTION_TITLE_CLASSES}>
              Planner Context ({contextFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContextFilesList files={contextFiles} onSelect={openContextFile} />
          </CardContent>
        </Card>
      )}

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

      {/* Slide-out context file panel */}
      <Sheet open={isContextPanelOpen} onOpenChange={handleContextSheetChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full p-0 data-[side=right]:sm:max-w-4xl"
        >
          {selectedContextFile && (
            <ContextFilePanel
              file={selectedContextFile}
              content={contextFileContent}
              loading={contextFileLoading}
              onClose={closeContextFile}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
