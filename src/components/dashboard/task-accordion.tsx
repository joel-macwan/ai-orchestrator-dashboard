import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCost, capitalize } from '@/lib/format';
import {
  PHASE_ACCORDION_PREFIX,
  PHASE_STATUS_BADGE_STYLES,
  PHASE_STATUS_ICON_STYLES,
  PHASE_TO_TASK_STATUS,
  STEP_ACCORDION_PREFIX,
  TASK_STATUS_ORDER,
} from '@/lib/constants';
import type { PhaseInfo, AgentTask, TaskStatus, AgentInfo, PipelineStepState, TaskRowProps, PhaseTaskRow, TaskAccordionProps } from '@/lib/types';
import {
  Check,
  RefreshCw,
  Clock,
  ChevronRight,
  X,
  Cpu,
  SkipForward,
} from 'lucide-react';

// ─── Shared Styles ─────────────────────────────────────────────────────────

/** Shared classes for clickable task/phase rows inside the accordion. */
const TASK_ROW_CLASSES = cn(
  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
  'bg-muted hover:bg-muted-foreground/10 border border-border/40 transition-colors duration-200'
);

/** Shared classes for the cost label shown on each row. */
const COST_LABEL_CLASSES = 'w-14 text-xs text-foreground tabular-nums font-semibold';

// ─── Status Dot ─────────────────────────────────────────────────────────────

const TASK_STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  completed: 'bg-chart-4',
  in_progress: 'bg-amber-400',
  pending: 'bg-muted-foreground',
  failed: 'bg-red-500',
  blocked: 'bg-muted-foreground',
};

/** Small colored dot indicating task status, with pulse animation for in-progress. */
function TaskStatusDot({ status }: { status: TaskStatus }) {
  const colorClass = TASK_STATUS_DOT_COLORS[status];
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {status === 'in_progress' && (
        <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colorClass)} />
      )}
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colorClass)} />
    </span>
  );
}

// ─── Phase Status Icons ─────────────────────────────────────────────────────

const PHASE_STATUS_ICONS: Record<string, React.ElementType> = {
  done: Check,
  running: RefreshCw,
  pending: Clock,
  failed: X,
  skipped: SkipForward,
};

const DEFAULT_PHASE_ICON = Clock;

// ─── Task Row ───────────────────────────────────────────────────────────────

/** A single task row inside an expanded phase accordion. */
function TaskRow({ task, onSelect }: TaskRowProps) {
  const handleClick = () => onSelect(task.id);
  const hasBlockers = task.blockedBy.length > 0;

  return (
    <button onClick={handleClick} className={TASK_ROW_CLASSES}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{task.title}</span>
        </div>
        {hasBlockers && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Blocked by: {task.blockedBy.join(', ')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <TaskStatusDot status={task.status} />
        <span className={COST_LABEL_CLASSES}>
          {formatCost(task.tokenUsage?.costUsd ?? 0)}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ─── Phase Main Task Row (for phases without subtasks) ──────────────────────

/** Row shown for phases that have no individual subtasks. */
function PhaseMainTaskRow({ task, onSelect }: { task: PhaseTaskRow; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className={TASK_ROW_CLASSES}>
      <div className="flex-1 min-w-0">
        <span className="truncate">{task.title}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <TaskStatusDot status={task.status} />
        <span className={COST_LABEL_CLASSES}>
          {formatCost(task.cost)}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a lookup of stepId -> tasks from the pipeline steps. */
function buildStepTasksMap(steps: PipelineStepState[]): Map<string, AgentTask[]> {
  const map = new Map<string, AgentTask[]>();
  for (const step of steps) {
    if (step.tasks && step.tasks.length > 0) {
      map.set(step.id, step.tasks);
    }
  }
  return map;
}

/** Sum the cost of all tasks/agents/step-itself belonging to a phase. */
function getPhaseCost(
  phase: PhaseInfo,
  stepTasksMap: Map<string, AgentTask[]>,
  steps: PipelineStepState[],
  agents: AgentInfo[],
): number {
  if (!phase.stepId) return 0;
  const tasks = stepTasksMap.get(phase.stepId);
  if (tasks) {
    return tasks.reduce((sum, t) => sum + (t.tokenUsage?.costUsd ?? 0), 0);
  }
  // No subtasks — prefer the step's own tokenUsage, fall back to agent logs.
  const step = steps.find((s) => s.id === phase.stepId);
  if (step?.tokenUsage?.costUsd) return step.tokenUsage.costUsd;
  return agents
    .filter((a) => a.name === phase.stepId)
    .reduce((sum, a) => sum + (a.tokenUsage?.costUsd ?? 0), 0);
}

/** Build the accordion item value from a phase. */
function getPhaseItemValue(phase: PhaseInfo): string {
  return phase.stepId
    ? `${STEP_ACCORDION_PREFIX}${phase.stepId}`
    : `${PHASE_ACCORDION_PREFIX}${phase.id}`;
}

/** Create a synthetic task row for phases that have no subtasks. */
function getPhaseMainTask(phase: PhaseInfo, cost: number): PhaseTaskRow {
  return {
    id: getPhaseItemValue(phase),
    title: `${phase.label} phase`,
    status: PHASE_TO_TASK_STATUS[phase.status] ?? 'pending',
    cost,
  };
}

// ─── Main Phase Task Accordion ──────────────────────────────────────────────

export function TaskAccordion({ phases, steps, tasks, agents, onSelectTask, onSelectPhase }: TaskAccordionProps) {
  const stepTasksMap = buildStepTasksMap(steps);

  // Auto-expand phases that have subtasks
  const defaultOpenValues = phases
    .filter((p) => p.stepId && stepTasksMap.has(p.stepId))
    .map((p) => `${STEP_ACCORDION_PREFIX}${p.stepId}`);

  const sortedTasks = [...tasks].sort(
    (a, b) => TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]
  );

  return (
    <Accordion multiple defaultValue={defaultOpenValues}>
      {phases.map((phase) => {
        const Icon = PHASE_STATUS_ICONS[phase.status] ?? DEFAULT_PHASE_ICON;
        const iconStyle = PHASE_STATUS_ICON_STYLES[phase.status] ?? '';
        const hasSubtasks = phase.stepId ? stepTasksMap.has(phase.stepId) : false;
        const phaseTasks = hasSubtasks ? sortedTasks : [];
        const phaseCost = getPhaseCost(phase, stepTasksMap, steps, agents);
        const mainTask = hasSubtasks ? null : getPhaseMainTask(phase, phaseCost);
        const itemValue = getPhaseItemValue(phase);
        const phaseStatusLabel = phase.status === 'done' ? 'Completed' : capitalize(phase.status);

        return (
          <AccordionItem key={itemValue} value={itemValue} className="bg-muted/40 rounded-lg px-1 mb-2 border border-border/50">
            {/* Phase header with icon, label, count, badge, and cost */}
            <AccordionTrigger className="px-3 py-3">
              <div className="flex items-center w-full">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Icon className={cn('h-5 w-5 shrink-0', iconStyle)} />
                  <span className="font-semibold text-base">{phase.label}</span>
                  {hasSubtasks && (
                    <span className="text-sm text-muted-foreground">
                      ({tasks.filter((t) => t.status === 'completed').length}/{tasks.length})
                    </span>
                  )}
                  {phase.model && (
                    <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-blue-500 text-white border-border font-normal">
                      <Cpu className="h-3 w-3" />
                      {phase.model}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={cn('text-xs', PHASE_STATUS_BADGE_STYLES[phase.status])}>
                    {phaseStatusLabel}
                  </Badge>
                  <span className={cn(COST_LABEL_CLASSES, 'mr-4')}>
                    {formatCost(phaseCost)}
                  </span>
                </div>
              </div>
            </AccordionTrigger>

            {/* Phase content: subtask list or single main-task row */}
            <AccordionContent className="px-1 pb-2">
              {hasSubtasks ? (
                <div className="space-y-1.5">
                  {phaseTasks.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No tasks yet — waiting for planner
                    </p>
                  ) : (
                    phaseTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onSelect={onSelectTask} />
                    ))
                  )}
                </div>
              ) : mainTask ? (
                <PhaseMainTaskRow
                  task={mainTask}
                  onSelect={() => onSelectPhase(phase.stepId ?? phase.label)}
                />
              ) : null}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
