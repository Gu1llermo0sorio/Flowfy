import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Goal, GoalType, Currency } from '../types';

// ── Fetch ─────────────────────────────────────────────────────────────────────

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Goal[] }>('/goals');
      return data.data;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface GoalPayload {
  name: string;
  description?: string;
  type: GoalType;
  targetAmount: number;
  currency?: Currency;
  targetDate?: string;
  emoji?: string;
}

export interface GoalUpdatePayload extends Partial<GoalPayload> {
  currentAmount?: number;
  isCompleted?: boolean;
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GoalPayload) => {
      const { data } = await apiClient.post<{ success: boolean; data: Goal }>('/goals', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: GoalUpdatePayload & { id: string }) => {
      const { data } = await apiClient.patch<{ success: boolean; data: Goal }>(`/goals/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/goals/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}
