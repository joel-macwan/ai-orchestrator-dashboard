import { useState, useCallback } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Bot,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { usePolling } from '@/hooks/use-polling';
import { fetchProjects, fetchRuns, addProject, removeProject } from '@/lib/api';
import { formatRelativeTime, formatCost, capitalize } from '@/lib/format';
import { AddProjectDialog } from '@/components/projects/add-project-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RUN_STATUS_BADGE_STYLES, RUN_STATUS_COLORS, RunStatusValue } from '@/lib/constants';
import type { Project, RunSummary, ProjectRunsProps, AppSidebarProps } from '@/lib/types';

// ─── Status Icons ───────────────────────────────────────────────────────────

const RUN_STATUS_ICONS: Record<RunSummary['status'], React.ElementType> = {
  [RunStatusValue.Running]: RefreshCw,
  [RunStatusValue.Completed]: CheckCircle2,
  [RunStatusValue.Failed]: XCircle,
  [RunStatusValue.Pending]: Clock,
};

// ─── Shared Styles ──────────────────────────────────────────────────────────

const ICON_BUTTON_BASE = 'flex h-7 w-7 items-center justify-center rounded-md';
const RUN_ITEM_CLASSES = [
  'flex items-start gap-2 py-2 h-auto border border-transparent',
  'dark:bg-muted/40',
  'hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20',
  'data-active:bg-muted-foreground/10 dark:data-active:bg-muted-foreground/30',
  'data-active:border-border',
].join(' ');

// ─── Project Runs Section ───────────────────────────────────────────────────

function ProjectRuns({ project, selectedRun, onSelectRun, onRemove }: ProjectRunsProps) {
  const fetcher = useCallback(() => fetchRuns(project.id), [project.id]);
  const { data: runs } = usePolling(fetcher);

  const handleRemove = useCallback(() => {
    onRemove(project.id);
  }, [project.id, onRemove]);

  const handleSelectRun = useCallback((ticketId: string) => {
    onSelectRun(project.id, ticketId);
  }, [project.id, onSelectRun]);

  const hasRuns = runs && runs.length > 0;

  return (
    <SidebarGroup>
      {/* Project header with name and delete button */}
      <SidebarGroupLabel className="flex items-center justify-between px-0 text-sm font-semibold mb-2">
        <span className="truncate">{project.name}</span>
        <button
          onClick={handleRemove}
          className={`${ICON_BUTTON_BASE} bg-red-500/10 text-red-500 hover:bg-red-500/20`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </SidebarGroupLabel>

      {/* List of runs for this project */}
      <SidebarGroupContent>
        <SidebarMenu>
          {runs?.map((run) => {
            const StatusIcon = RUN_STATUS_ICONS[run.status];
            const statusColor = RUN_STATUS_COLORS[run.status];
            const isRunning = run.status === RunStatusValue.Running;

            return (
              <SidebarMenuItem key={run.ticketId}>
                <SidebarMenuButton
                  isActive={selectedRun === run.ticketId}
                  onClick={() => handleSelectRun(run.ticketId)}
                  className={RUN_ITEM_CLASSES}
                >
                  <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${statusColor} ${isRunning ? 'animate-spin' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{run.ticketId}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {run.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] h-4 ${RUN_STATUS_BADGE_STYLES[run.status]}`}>
                        {capitalize(run.status)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(run.startedAt)}
                      </span>
                      <span className="text-xs font-semibold ml-auto">
                        {formatCost(run.totalCostUsd)}
                      </span>
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          {!hasRuns && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No runs found</p>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ─── Main Sidebar ───────────────────────────────────────────────────────────

export function AppSidebar({ selectedProjectId, selectedRunId, onSelectRun, onProjectRemoved }: AppSidebarProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const { data: projects, refresh } = usePolling(fetchProjects);

  const hasProjects = projects && projects.length > 0;
  const isDeleteDialogOpen = projectToDelete !== null;

  const openAddDialog = useCallback(() => {
    setAddDialogOpen(true);
  }, []);

  const closeAddDialog = useCallback(() => {
    setAddDialogOpen(false);
  }, []);

  const handleAddProject = useCallback(async (name: string, runsPath: string) => {
    await addProject(name, runsPath);
    refresh();
  }, [refresh]);

  /** Show confirmation dialog before removing a project. */
  const requestRemoveProject = useCallback((id: string) => {
    const project = projects?.find((p) => p.id === id);
    if (project) {
      setProjectToDelete(project);
    }
  }, [projects]);

  const cancelRemoveProject = useCallback(() => {
    setProjectToDelete(null);
  }, []);

  /** Remove the project and reset selection if it was active. */
  const confirmRemoveProject = useCallback(async () => {
    if (!projectToDelete) return;
    const removedId = projectToDelete.id;
    await removeProject(removedId);
    setProjectToDelete(null);
    refresh();
    onProjectRemoved(removedId);
  }, [projectToDelete, refresh, onProjectRemoved]);

  const handleDeleteDialogChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setProjectToDelete(null);
    }
  }, []);

  return (
    <>
      <Sidebar>
        {/* Sidebar branding */}
        <SidebarHeader className="border-b border-sidebar-border px-4 h-14 flex flex-row items-center justify-center">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <span className="font-semibold text-sm">AI Orchestrator</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Projects header with add button */}
          <SidebarGroup>
            <div className="flex items-center justify-between">
              <SidebarGroupLabel className="px-0 text-lg font-semibold">Projects</SidebarGroupLabel>
              <button
                onClick={openAddDialog}
                title="Add project"
                className={`${ICON_BUTTON_BASE} bg-blue-500/10 text-blue-500 hover:bg-blue-500/20`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 border-t border-sidebar-border" />
          </SidebarGroup>

          {/* Project list with their runs */}
          {projects?.map((project) => (
            <ProjectRuns
              key={project.id}
              project={project}
              selectedRun={selectedProjectId === project.id ? selectedRunId : null}
              onSelectRun={onSelectRun}
              onRemove={requestRemoveProject}
            />
          ))}

          {/* Empty state when no projects exist */}
          {!hasProjects && (
            <div className="px-4 py-8 text-center">
              <p className="text-base text-muted-foreground mb-3">No projects added yet</p>
              <button
                onClick={openAddDialog}
                className="text-base font-medium text-primary hover:underline"
              >
                + Add your first project
              </button>
            </div>
          )}
        </SidebarContent>
      </Sidebar>

      {/* Add project dialog */}
      <AddProjectDialog
        open={addDialogOpen}
        onClose={closeAddDialog}
        onAdd={handleAddProject}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will remove <span className="font-medium text-foreground">{projectToDelete?.name}</span> from the dashboard. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelRemoveProject}>
              Cancel
            </Button>
            <Button onClick={confirmRemoveProject}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
