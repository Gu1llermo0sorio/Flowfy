import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Family, FamilyMember } from '../types';

// ── Fetch ─────────────────────────────────────────────────────────────────────

export function useFamily() {
  return useQuery<Family>({
    queryKey: ['family'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Family }>('/family');
      return data.data;
    },
  });
}

export function useFamilyMembers() {
  return useQuery<(FamilyMember & { userBadges?: { badge: { name: string; icon: string } }[] })[]>({
    queryKey: ['family-members'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: FamilyMember[] }>('/family/members');
      return data.data;
    },
  });
}

export function useLeaderboard() {
  return useQuery<Pick<FamilyMember, 'id' | 'name' | 'avatar' | 'xp' | 'level' | 'streakDays'>[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: FamilyMember[] }>('/family/leaderboard');
      return data.data;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useUpdateFamilySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string; currency?: 'UYU' | 'USD' }) => {
      const { data } = await apiClient.patch<{ success: boolean; data: Family }>('/family', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family'] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string; avatar?: string }) => {
      const { data } = await apiClient.patch<{ success: boolean; data: FamilyMember }>('/family/profile', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-members'] });
      qc.invalidateQueries({ queryKey: ['family'] });
    },
  });
}
