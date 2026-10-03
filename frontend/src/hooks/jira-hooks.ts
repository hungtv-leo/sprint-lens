import { useQuery } from '@tanstack/react-query'

import {
  getAppConfig,
  getBoards,
  getIssues,
  getJiraHealth,
  getProjects,
  getSprints,
  getStatuses,
  getSummary,
  getUsers,
} from '../lib/api'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function useStatuses(projects: string[]) {
  return useQuery({
    queryKey: ['statuses', projects],
    queryFn: () => getStatuses(projects),
    enabled: projects.length > 0,
    staleTime: 60_000,
  })
}

export function useSprints(projects: string[]) {
  return useQuery({
    queryKey: ['sprints', projects],
    queryFn: () => getSprints(projects),
    enabled: projects.length > 0,
    staleTime: 60_000,
  })
}

export function useBoards(projects: string[]) {
  return useQuery({
    queryKey: ['boards', projects],
    queryFn: () => getBoards(projects),
    enabled: projects.length > 0,
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
  board?: string
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
  board?: string
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

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: getAppConfig,
    staleTime: 300_000,
  })
}

export function useJiraHealth() {
  return useQuery({
    queryKey: ['jira-health'],
    queryFn: getJiraHealth,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
