import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Transaction, TransactionFilters, Category, MonthlySummary } from '../types';

// ── Response types ─────────────────────────────────────────────────────────────
interface TransactionListResponse {
  success: boolean;
  data: Transaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface TxPayload {
  amount: number;         // centavos
  currency: 'UYU' | 'USD';
  description: string;
  date: string;           // ISO
  type: 'income' | 'expense';
  categoryId: string;
  subcategoryId?: string;
  paymentMethod?: 'cash' | 'debit' | 'credit' | 'transfer' | 'other';
  notes?: string;
  tags?: string[];
  isRecurring?: boolean;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      (Object.entries(filters) as [string, unknown][]).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      });
      const { data } = await apiClient.get<TransactionListResponse>(
        `/transactions?${params.toString()}`
      );
      return data;
    },
  });
}

export function useMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: ['transactions', 'summary', year, month],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: MonthlySummary }>(
        `/transactions/summary/monthly?year=${year}&month=${month}`
      );
      return data.data;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Category[] }>('/categories');
      return data.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TxPayload) => {
      const { data } = await apiClient.post<{ success: boolean; data: Transaction }>(
        '/transactions',
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<TxPayload> }) => {
      const { data } = await apiClient.patch<{ success: boolean; data: Transaction }>(
        `/transactions/${id}`,
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/transactions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
