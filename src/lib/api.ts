import type {
  Project,
  RunSummary,
  RunDetail,
  LogEntry,
  DirectoryListing,
  ContextFile,
  ContextFileContent,
} from './types';
import { API_BASE, ApiRoute } from './constants';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Projects ───────────────────────────────────────────────────────────────

export function fetchProjects(): Promise<Project[]> {
  return fetchJson(ApiRoute.Projects);
}

export function addProject(name: string, runsPath: string): Promise<Project> {
  return fetchJson(ApiRoute.Projects, {
    method: 'POST',
    body: JSON.stringify({ name, runsPath }),
  });
}

export function removeProject(id: string): Promise<void> {
  return fetchJson(`${ApiRoute.Projects}/${id}`, { method: 'DELETE' });
}

// ─── Runs ───────────────────────────────────────────────────────────────────

export function fetchRuns(projectId: string): Promise<RunSummary[]> {
  return fetchJson(`${ApiRoute.Projects}/${projectId}/runs`);
}

export function fetchRunDetail(projectId: string, ticketId: string): Promise<RunDetail> {
  return fetchJson(`${ApiRoute.Runs}/${projectId}/${ticketId}`);
}

// ─── Logs ───────────────────────────────────────────────────────────────────

export function fetchTaskLogs(
  projectId: string,
  ticketId: string,
  taskId: string
): Promise<LogEntry[]> {
  return fetchJson(`${ApiRoute.Runs}/${projectId}/${ticketId}/tasks/${taskId}/logs`);
}

export function fetchPhaseLogs(
  projectId: string,
  ticketId: string,
  phase: string
): Promise<LogEntry[]> {
  return fetchJson(`${ApiRoute.Runs}/${projectId}/${ticketId}/phases/${phase}/logs`);
}

// ─── Context Files ──────────────────────────────────────────────────────────

export function fetchContextFiles(
  projectId: string,
  ticketId: string
): Promise<ContextFile[]> {
  return fetchJson(`${ApiRoute.Runs}/${projectId}/${ticketId}/context-files`);
}

export function fetchContextFileContent(
  projectId: string,
  ticketId: string,
  relativePath: string
): Promise<ContextFileContent> {
  return fetchJson(
    `${ApiRoute.Runs}/${projectId}/${ticketId}/context-files/content?path=${encodeURIComponent(relativePath)}`
  );
}

// ─── Browse ─────────────────────────────────────────────────────────────────

export function browseDirectory(dirPath?: string): Promise<DirectoryListing> {
  const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
  return fetchJson(`${ApiRoute.Browse}${params}`);
}
