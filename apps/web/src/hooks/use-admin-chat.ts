import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { chatKeys } from '@/lib/query-keys'
import type { Message } from '@shared/types/chat.types'

export function useFlaggedMessages(page = 1, limit = 20) {
  return useQuery({
    queryKey: chatKeys.flagged(page, limit),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: Message[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>('/chat/flagged', { params: { page, limit } })
      return { messages: res.data.data, pagination: res.data.pagination }
    },
  })
}
