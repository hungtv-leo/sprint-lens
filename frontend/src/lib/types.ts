export type JiraProject = {
  key: string
  name: string
  project_type?: string | null
}

export type JiraStatus = {
  id: string
  name: string
  category_key: string
  category_name: string
}

export type JiraSprint = {
  id: number
  name: string
  state: string
  goal?: string | null
  start_date?: string | null
  end_date?: string | null
}

export type JiraIssue = {
  key: string
  summary: string
  status_id: string
  status_name: string
  status_category: string
  priority?: string | null
  assignee: {
    display_name: string
    avatar_url?: string | null
  }
  updated?: string | null
  due_date?: string | null
  issue_type?: string | null
  project_key: string
  project_name: string
  sprint_names: string[]
  url: string
  story_points?: number | null
}

export type SummaryResponse = {
  total: number
  statuses: Array<{
    status_name: string
    total: number
    category_key: string
  }>
  assignees: Array<{
    assignee: string
    total: number
  }>
  unstarted: JiraIssue[]
  testing: JiraIssue[]
}

export type JiraUser = {
  name?: string | null
  key?: string | null
  account_id?: string | null
  display_name: string
  email?: string | null
  avatar_url?: string | null
  active?: boolean
}

export type KpiPeriodType = 'sprint' | 'month'

export type KpiRequest = {
  role: 'developer'
  period: {
    type: KpiPeriodType
    sprint?: string | null
    month?: string | null
  }
  assignee: string
  projects: string[]
}

export type KpiStats = {
  committed: number
  completed: number
  incomplete: number
  on_time_completed: number
  on_time_eligible: number
  commitment_rate: number
  schedule_rate: number | null
  throughput_rate: number | null
}

export type KpiCalculateResponse = {
  role: string
  period: KpiRequest['period']
  assignee: string
  projects: string[]
  issue_count: number
  agent: string
  result: {
    stats: KpiStats
    cell_updates: Array<{ sheet: string; cell: string; value: number | string }>
    evidence: Array<{ key: string; bucket: string; note: string }>
    notes: string[]
  }
}
