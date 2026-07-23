import { useQuery } from '@tanstack/react-query'

import { getIssues, getProjects, getSprints, getStatuses, getSummary, getUsers } from '../lib/api'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function useStatuses(project?: string) {
  return useQuery({
    queryKey: ['statuses', project],
    queryFn: () => getStatuses(project!),
    enabled: Boolean(project),
    staleTime: 60_000,
  })
}

export function useSprints(project?: string) {
  return useQuery({
    queryKey: ['sprints', project],
    queryFn: () => getSprints(project!),
    enabled: Boolean(project),
    staleTime: 60_000,
  })
}

export function useUsers(projects: string[], q?: string) {
  return useQuery({
    queryKey: ['users', projects, q ?? ''],
    queryFn: () => getUsers({ projects, q }),
    enabled: projects.length > 0,
    staleTime: 60_000,
  })
}

export function useIssues(params: {
  projects: string[]
  sprint?: string
  assignee?: string
  q?: string
}) {
  return useQuery({
    queryKey: ['issues', params],
    queryFn: () => getIssues(params),
    enabled: params.projects.length > 0,
    refetchInterval: 30_000,
  })
}

export function useSummary(params: {
  projects: string[]
  sprint?: string
  assignee?: string
  q?: string
}) {
  return useQuery({
    queryKey: ['summary', params],
    queryFn: () => getSummary(params),
    enabled: params.projects.length > 0,
    refetchInterval: 30_000,
  })
}
