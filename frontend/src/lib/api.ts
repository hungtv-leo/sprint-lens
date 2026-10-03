import type {
  AppConfig,
  IssuesResponse,
  JiraHealth,
  JiraProject,
  JiraSprint,
  JiraStatus,
  JiraUser,
  KpiCalculateResponse,
  KpiRequest,
  OpsCaseCreate,
  OpsCaseItem,
  OpsCaseListResponse,
  OpsCaseStatsResponse,
  OpsWorkType,
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

export function getStatuses(projects: string[]) {
  const search = new URLSearchParams({ projects: projects.join(',') })
  return request<JiraStatus[]>(`/api/statuses?${search.toString()}`)
}

export function getSprints(projects: string[]) {
  const search = new URLSearchParams({ projects: projects.join(',') })
  return request<JiraSprint[]>(`/api/sprints?${search.toString()}`)
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

  return request<IssuesResponse>(`/api/issues?${search.toString()}`)
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

export function getAppConfig() {
  return request<AppConfig>('/api/config')
}

export function getJiraHealth() {
  return request<JiraHealth>('/api/health/jira')
}

function buildKpiFormData(body: KpiRequest, workbook?: File) {
  const form = new FormData()
  form.set('role', body.role)
  form.set('period_type', body.period.type)
  form.set('assignee', body.assignee)
  form.set('projects', JSON.stringify(body.projects))
  if (body.period.sprint) form.set('sprint', body.period.sprint)
  if (body.period.month) form.set('month', body.period.month)
  if (workbook) form.set('workbook', workbook)
  return form
}

export async function calculateKpiWithWorkbook(
  body: KpiRequest,
  workbook?: File,
): Promise<KpiCalculateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/kpi/calculate`, {
    method: 'POST',
    body: buildKpiFormData(body, workbook),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<KpiCalculateResponse>
}

export async function exportKpi(body: KpiRequest, workbook?: File): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/kpi/export`, {
    method: 'POST',
    body: buildKpiFormData(body, workbook),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.blob()
}

export async function downloadKpiTemplate(): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/kpi/template`)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return response.blob()
}

export function userFilterValue(user: JiraUser) {
  return user.name || user.key || user.display_name
}

export function getOpsWorkTypes() {
  return request<OpsWorkType[]>('/api/ops/work-types')
}

export function createOpsCase(body: OpsCaseCreate) {
  return request<OpsCaseItem>('/api/ops/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getOpsCases(params: { month?: string; handler?: string; limit?: number }) {
  const search = new URLSearchParams()
  if (params.month) search.set('month', params.month)
  if (params.handler) search.set('handler', params.handler)
  if (params.limit != null) search.set('limit', String(params.limit))
  const query = search.toString()
  return request<OpsCaseListResponse>(`/api/ops/cases${query ? `?${query}` : ''}`)
}

export function getOpsCaseStats(month: string) {
  const search = new URLSearchParams({ month })
  return request<OpsCaseStatsResponse>(`/api/ops/cases/stats?${search.toString()}`)
}

export async function exportOpsCases(month: string): Promise<Blob> {
  const search = new URLSearchParams({ month })
  const response = await fetch(`${API_BASE_URL}/api/ops/cases/export?${search.toString()}`)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }
  return response.blob()
}
