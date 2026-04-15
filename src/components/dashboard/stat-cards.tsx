import { DollarSign, Clock, Cpu, Zap, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CircularProgress } from './circular-progress';
import { formatCost, formatElapsed, formatTokens } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  BUDGET_THRESHOLD_HIGH,
  BUDGET_THRESHOLD_MID,
  STAT_CIRCULAR_SIZE,
  STAT_CIRCULAR_STROKE,
  STAT_COLORS,
  StepStatusValue,
  TaskStatusValue,
} from '@/lib/constants';
import type { StatCardsProps } from '@/lib/types';

export function StatCards({ detail }: StatCardsProps) {
  const { state, totalBudget } = detail;
  // Phases that don't fan out into subtasks still count as a single unit of
  // work — so a step with no tasks contributes 1 to the total (and to the
  // completed/failed buckets when it reaches a terminal status).
  const stepsWithoutTasks = state.steps.filter((s) => !s.tasks || s.tasks.length === 0);
  const completed =
    state.tasks.filter((t) => t.status === TaskStatusValue.Completed).length +
    stepsWithoutTasks.filter((s) => s.status === StepStatusValue.Completed).length;
  const failed =
    state.tasks.filter((t) => t.status === TaskStatusValue.Failed).length +
    stepsWithoutTasks.filter((s) => s.status === StepStatusValue.Failed).length;
  const total = state.tasks.length + stepsWithoutTasks.length;
  const budgetPct = totalBudget > 0 ? state.totalCostUsd / totalBudget : 0;
  const budgetColor = STAT_COLORS.budget;

  const totalInput =
    state.totalTokenUsage?.inputTokens ??
    state.tasks.reduce((s, t) => s + (t.tokenUsage?.inputTokens ?? 0), 0);
  const totalOutput =
    state.totalTokenUsage?.outputTokens ??
    state.tasks.reduce((s, t) => s + (t.tokenUsage?.outputTokens ?? 0), 0);

  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
      {/* Tasks */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-5 p-5">
            <CircularProgress
              value={completed}
              max={total || 1}
              display={`${Math.round((completed / (total || 1)) * 100)}%`}
              color={STAT_COLORS.tasks}
              size={STAT_CIRCULAR_SIZE}
              strokeWidth={STAT_CIRCULAR_STROKE}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Tasks
              </p>
              <p className="text-3xl font-bold tabular-nums">{completed}<span className="text-lg text-muted-foreground font-normal">/{total}</span></p>
              {failed > 0 && (
                <p className="text-sm text-red-500 font-medium">{failed} failed</p>
              )}
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-500/80 to-green-500/20 w-full" />
        </CardContent>
      </Card>

      {/* Cost / Budget */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-5 p-5">
            <CircularProgress
              value={Math.round(budgetPct * 100)}
              max={100}
              display={`${Math.round(budgetPct * 100)}%`}
              color={budgetColor}
              size={STAT_CIRCULAR_SIZE}
              strokeWidth={STAT_CIRCULAR_STROKE}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Cost
              </p>
              <p className="text-3xl font-bold tabular-nums">{formatCost(state.totalCostUsd)}</p>
              <p className="text-sm text-muted-foreground">
                of {formatCost(totalBudget)} budget
              </p>
            </div>
          </div>
          <div
            className={cn(
              'h-1 w-full bg-gradient-to-r',
              budgetPct > BUDGET_THRESHOLD_HIGH ? 'from-amber-500/80 to-amber-500/20' : budgetPct > BUDGET_THRESHOLD_MID ? 'from-yellow-500/80 to-yellow-500/20' : 'from-amber-500/60 to-amber-500/10'
            )}
          />
        </CardContent>
      </Card>

      {/* Elapsed Time */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-5 p-5">
            <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-muted/50">
              <Clock className="h-12 w-12 text-blue-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Elapsed</p>
              <p className="text-3xl font-bold tabular-nums">{formatElapsed(state.startedAt, state.completedAt)}</p>
              <p className="text-sm text-muted-foreground font-mono truncate max-w-[140px]" title={state.branch}>
                {state.branch}
              </p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-blue-500/60 to-blue-500/10 w-full" />
        </CardContent>
      </Card>

      {/* Tokens */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-5 p-5">
            <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-muted/50">
              <Cpu className="h-12 w-12 text-violet-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Tokens</p>
              <div className="space-y-1">
                <p className="text-lg font-semibold tabular-nums flex items-center gap-1.5">
                  <ArrowDownRight className="h-4 w-4 text-blue-400" />
                  {formatTokens(totalInput)}
                </p>
                <p className="text-lg font-semibold tabular-nums flex items-center gap-1.5">
                  <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  {formatTokens(totalOutput)}
                </p>
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-violet-500/60 to-violet-500/10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
