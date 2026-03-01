import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppLanguage = 'es' | 'en';
export type DateFormatOption = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';

interface SettingsStore {
  // General
  language: AppLanguage;
  defaultCurrency: 'UYU' | 'USD' | 'EUR';
  dateFormat: DateFormatOption;
  // Notifications
  emailNotifications: boolean;
  budgetAlerts: boolean;
  goalAlerts: boolean;
  weeklyReport: boolean;
  // UI
  compactMode: boolean;
  showCentsAlways: boolean;

  setLanguage: (v: AppLanguage) => void;
  setDefaultCurrency: (v: 'UYU' | 'USD' | 'EUR') => void;
  setDateFormat: (v: DateFormatOption) => void;
  setEmailNotifications: (v: boolean) => void;
  setBudgetAlerts: (v: boolean) => void;
  setGoalAlerts: (v: boolean) => void;
  setWeeklyReport: (v: boolean) => void;
  setCompactMode: (v: boolean) => void;
  setShowCentsAlways: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      language: 'es',
      defaultCurrency: 'UYU',
      dateFormat: 'dd/MM/yyyy',
      emailNotifications: true,
      budgetAlerts: true,
      goalAlerts: true,
      weeklyReport: false,
      compactMode: false,
      showCentsAlways: false,

      setLanguage: (v) => set({ language: v }),
      setDefaultCurrency: (v) => set({ defaultCurrency: v }),
      setDateFormat: (v) => set({ dateFormat: v }),
      setEmailNotifications: (v) => set({ emailNotifications: v }),
      setBudgetAlerts: (v) => set({ budgetAlerts: v }),
      setGoalAlerts: (v) => set({ goalAlerts: v }),
      setWeeklyReport: (v) => set({ weeklyReport: v }),
      setCompactMode: (v) => set({ compactMode: v }),
      setShowCentsAlways: (v) => set({ showCentsAlways: v }),
    }),
    { name: 'flowfy-settings' }
  )
);
