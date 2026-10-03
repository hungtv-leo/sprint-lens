import { useQuery } from '@tanstack/react-query'

import { getWeeklyReport } from '../lib/api'

export function useWeeklyReport(params: {
  projects: string[]
  assignees: string[]
  date_from?: string
  date_to?: string
}) {
  return useQuery({
    queryKey: ['weekly-report', params],
    queryFn: () => getWeeklyReport(params),
    enabled: params.projects.length > 0 && params.assignees.length > 0,
    staleTime: 30_000,
  })
}
