import type {
  JiraIssue,
  JiraProject,
  JiraSprint,
  JiraStatus,
  JiraUser,
  KpiCalculateResponse,
  KpiRequest,
  SummaryResponse,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getProjects() {
  return request<JiraProject[]>('/api/projects')
}

export function getStatuses(project: string) {
  return request<JiraStatus[]>(`/api/statuses?project=${encodeURIComponent(project)}`)
}

export function getSprints(project: string) {
  return request<JiraSprint[]>(`/api/sprints?project=${encodeURIComponent(project)}`)
}

export function getUsers(params: { projects: string[]; q?: string }) {
  const search = new URLSearchParams({
    projects: params.projects.join(','),
  })
  if (params.q) search.set('q', params.q)
  return request<JiraUser[]>(`/api/users?${search.toString()}`)
}

export function getIssues(params: {
  projects: string[]
  sprint?: string
  assignee?: string
  q?: string
}) {
  const search = new URLSearchParams({
    projects: params.projects.join(','),
  })
  if (params.sprint) search.set('sprint', params.sprint)

  if (params.assignee) search.set('assignee', params.assignee)
  if (params.q) search.set('q', params.q)

  return request<JiraIssue[]>(`/api/issues?${search.toString()}`)
}

export function getSummary(params: {
  projects: string[]
  sprint?: string
  assignee?: string
  q?: string
}) {
  const search = new URLSearchParams({
    projects: params.projects.join(','),
  })
  if (params.sprint) search.set('sprint', params.sprint)

  if (params.assignee) search.set('assignee', params.assignee)
  if (params.q) search.set('q', params.q)

  return request<SummaryResponse>(`/api/summary?${search.toString()}`)
}

export function calculateKpi(body: KpiRequest) {
  return request<KpiCalculateResponse>('/api/kpi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function exportKpi(body: KpiRequest): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/kpi/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.blob()
}
