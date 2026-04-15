import {
  Check,
  RefreshCw,
  Clock,
  X,
  SkipForward,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { capitalize } from '@/lib/format';
import { PhaseStatusValue } from '@/lib/constants';
import type { PhaseStepperProps, PhaseInfo } from '@/lib/types';

// ─── Phase Step Styles ──────────────────────────────────────────────────────

/** Circle + label styles keyed by phase status. */
const PHASE_CIRCLE_STYLES: Record<string, string> = {
  [PhaseStatusValue.Done]: 'border-chart-4 bg-chart-4/10 text-chart-4',
  [PhaseStatusValue.Running]: 'border-amber-400 bg-amber-400/10 text-amber-400',
  [PhaseStatusValue.Failed]: 'border-red-500 bg-red-500/10 text-red-500',
  [PhaseStatusValue.Skipped]: 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
};

const PHASE_CIRCLE_DEFAULT = 'border-muted-foreground/20 bg-muted/50 text-muted-foreground';

const PHASE_LABEL_STYLES: Record<string, string> = {
  [PhaseStatusValue.Done]: 'text-chart-4',
  [PhaseStatusValue.Running]: 'text-amber-400 font-semibold',
  [PhaseStatusValue.Failed]: 'text-red-500 font-semibold',
  [PhaseStatusValue.Skipped]: 'text-muted-foreground',
};

const PHASE_LABEL_DEFAULT = 'text-muted-foreground/60';

/** Icon component for each phase status. */
const PHASE_STEP_ICONS: Record<string, React.ElementType> = {
  [PhaseStatusValue.Done]: Check,
  [PhaseStatusValue.Running]: RefreshCw,
  [PhaseStatusValue.Failed]: X,
  [PhaseStatusValue.Skipped]: SkipForward,
};

const DEFAULT_PHASE_STEP_ICON = Clock;

/** Height of the step circle, used to vertically center connectors. */
const STEP_CIRCLE_SIZE_PX = 48;

// ─── Phase Step ─────────────────────────────────────────────────────────────

function PhaseStep({ phase }: { phase: PhaseInfo }) {
  const isRunning = phase.status === PhaseStatusValue.Running;
  const Icon = PHASE_STEP_ICONS[phase.status] ?? DEFAULT_PHASE_STEP_ICON;
  const circleStyle = PHASE_CIRCLE_STYLES[phase.status] ?? PHASE_CIRCLE_DEFAULT;
  const labelStyle = PHASE_LABEL_STYLES[phase.status] ?? PHASE_LABEL_DEFAULT;

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="relative flex flex-col items-center">
          {/* Status circle with icon */}
          <div
            className={cn(
              'relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-500',
              circleStyle
            )}
          >
            {isRunning && (
              <span className="absolute inset-0 rounded-full animate-ping border-2 border-amber-400/30" />
            )}
            <Icon className={cn('h-5 w-5', isRunning && 'animate-spin')} />
          </div>

          {/* Phase label below the circle */}
          <span
            className={cn(
              'absolute top-full mt-2.5 text-xs font-medium whitespace-nowrap',
              labelStyle
            )}
          >
            {phase.label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Phase {phase.id}: {phase.label} — {capitalize(phase.status)}
        {phase.model && <> · {phase.model}</>}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Connector Line ─────────────────────────────────────────────────────────

function Connector({ done, active }: { done: boolean; active: boolean }) {
  const fillClass = done
    ? 'bg-chart-4 w-full'
    : active
      ? 'bg-amber-400 w-1/2 animate-pulse'
      : 'w-0';

  return (
    <div className="flex-1 px-2 self-stretch flex items-center" style={{ height: STEP_CIRCLE_SIZE_PX }}>
      <div className="relative h-0.5 w-full rounded-full overflow-hidden bg-muted-foreground/10">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-700', fillClass)}
        />
      </div>
    </div>
  );
}

// ─── Phase Stepper ──────────────────────────────────────────────────────────

export function PhaseStepper({ phases }: PhaseStepperProps) {
  return (
    <div className="flex items-start pt-2 pb-10 px-6">
      {phases.map((phase, i) => {
        const isLast = i === phases.length - 1;
        const next = phases[i + 1];
        const advanced =
          phase.status === PhaseStatusValue.Done || phase.status === PhaseStatusValue.Skipped;
        const connectorActive = advanced && next?.status === PhaseStatusValue.Running;

        return (
          <div key={phase.id} className="contents">
            <PhaseStep phase={phase} />
            {!isLast && (
              <Connector done={phase.status === PhaseStatusValue.Done} active={connectorActive} />
            )}
          </div>
        );
      })}
    </div>
  );
}
