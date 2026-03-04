import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Budget, Category } from '../types';

// ── Fetch ─────────────────────────────────────────────────────────────────────

export function useBudgets(month: number, year: number) {
  return useQuery<Budget[]>({
    queryKey: ['budgets', month, year],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Budget[] }>(
        `/budgets?month=${month}&year=${year}`
      );
      return data.data;
    },
  });
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Category[] }>('/categories');
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface BudgetPayload {
  categoryId: string;
  amount: number;
  currency?: 'UYU' | 'USD';
  month: number;
  year: number;
  rollover?: boolean;
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BudgetPayload) => {
      const { data } = await apiClient.post<{ success: boolean; data: Budget }>('/budgets', payload);
      return data.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['budgets', vars.month, vars.year] });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: BudgetPayload & { id: string }) => {
      const { data } = await apiClient.patch<{ success: boolean; data: Budget }>(`/budgets/${id}`, payload);
      return data.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['budgets', vars.month, vars.year] });
    },
  });
}

export function useDeleteBudget(month: number, year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/budgets/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets', month, year] });
    },
  });
}

// ── Category creation ─────────────────────────────────────────────────────────

export interface CategoryPayload {
  name: string;
  nameEs: string;
  icon: string;
  color: string;
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CategoryPayload) => {
      const { data } = await apiClient.post<{ success: boolean; data: Category }>('/categories', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
