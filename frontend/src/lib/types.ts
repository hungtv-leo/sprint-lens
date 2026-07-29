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
    name?: string | null
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

export type IssuesResponse = {
  issues: JiraIssue[]
  total: number
  returned: number
  truncated: boolean
}

export type SummaryResponse = {
  total: number
  returned: number
  truncated: boolean
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

export type AppConfig = {
  default_projects: string[]
  sprint_custom_field: string
}

export type JiraHealth = {
  status: string
  ok: boolean
  detail?: string | null
  display_name?: string | null
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
  schedule_source?: 'jira_due_date' | 'plan_due_date' | 'mixed' | 'none'
  schedule_coverage?: number | null
  throughput_rate: number | null
  throughput_source?: 'story_points' | 'scope_score' | 'hybrid' | 'none'
  throughput_coverage?: number | null
  throughput_completed_scope?: number | null
  throughput_committed_scope?: number | null
}

export type KpiPlanSummary = {
  sheet_name: string
  total_rows: number
  committed_rows: number
  excluded_rows: number
  duplicate_keys: number
  missing_key_rows: number
  invalid_rows: number
  matched_issue_count: number
  missing_in_jira_count: number
  assignee_mismatch_count: number
  unplanned_issue_count: number
}

export type KpiPlanValidationIssue = {
  row_number?: number | null
  issue_key?: string | null
  level: 'error' | 'warning'
  blocking: boolean
  code: string
  message: string
}

export type KpiCalculateResponse = {
  role: string
  period: KpiRequest['period']
  assignee: string
  projects: string[]
  issue_count: number
  dataset_truncated: boolean
  agent: string
  plan_summary?: KpiPlanSummary | null
  validation_issues: KpiPlanValidationIssue[]
  result: {
    stats: KpiStats
    cell_updates: Array<{ sheet: string; cell: string; value: number | string }>
    evidence: Array<{ key: string; bucket: string; note: string }>
    notes: string[]
    trace: string[]
  }
}
