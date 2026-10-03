import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createOpsCase, getOpsCaseStats, getOpsCases, getOpsWorkTypes } from '../lib/api'
import type { OpsCaseCreate } from '../lib/types'

export function useOpsWorkTypes() {
  return useQuery({
    queryKey: ['ops-work-types'],
    queryFn: getOpsWorkTypes,
    staleTime: 300_000,
  })
}

export function useOpsCases(params: { month?: string; handler?: string; limit?: number }) {
  return useQuery({
    queryKey: ['ops-cases', params],
    queryFn: () => getOpsCases(params),
    refetchInterval: 30_000,
  })
}

export function useOpsCaseStats(month: string) {
  return useQuery({
    queryKey: ['ops-case-stats', month],
    queryFn: () => getOpsCaseStats(month),
    enabled: Boolean(month),
    refetchInterval: 30_000,
  })
}

export function useCreateOpsCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpsCaseCreate) => createOpsCase(body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ops-cases'] }),
        queryClient.invalidateQueries({ queryKey: ['ops-case-stats'] }),
      ])
    },
  })
}
