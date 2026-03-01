import type { Currency } from '../types';

// Level definitions — must match backend xp.service.ts
const LEVELS: { level: number; title: string; minXP: number }[] = [
  { level: 1,  title: 'Ahorrador Novato',       minXP: 0     },
  { level: 2,  title: 'Planificador',            minXP: 100   },
  { level: 3,  title: 'Gestor Familiar',         minXP: 300   },
  { level: 4,  title: 'Inversor Principiante',   minXP: 700   },
  { level: 5,  title: 'Control Total',           minXP: 1500  },
  { level: 6,  title: 'Maestro del Presupuesto', minXP: 3000  },
  { level: 7,  title: 'Experto Financiero',      minXP: 6000  },
  { level: 8,  title: 'Asesor de Familia',       minXP: 12000 },
  { level: 9,  title: 'Gurú del Ahorro',         minXP: 25000 },
  { level: 10, title: 'Leyenda Financiera',      minXP: 50000 },
];

export interface LevelInfo {
  level: number;
  title: string;
  nextLevelXp: number;
  xpProgress: number; // 0–100 percentage
}

/**
 * Returns the level info for a given XP value.
 */
export function getLevelInfo(xp: number): LevelInfo {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
    else break;
  }
  const nextIdx = LEVELS.findIndex((l) => l.level === current.level) + 1;
  const nextLevelXp = nextIdx < LEVELS.length ? LEVELS[nextIdx].minXP : current.minXP * 2;
  const prevMinXP = current.minXP;
  const xpProgress = Math.min(
    ((xp - prevMinXP) / (nextLevelXp - prevMinXP)) * 100,
    100
  );
  return { level: current.level, title: current.title, nextLevelXp, xpProgress };
}

/**
 * Converts centavos (integer) to a decimal amount.
 */
export function centavosToAmount(centavos: number): number {
  return centavos / 100;
}

/**
 * Converts a decimal amount to centavos (integer).
 */
export function amountToCentavos(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Formats an amount in centavos as a currency string.
 * Uses DM Mono-friendly formatting.
 */
export function formatCurrency(
  centavos: number,
  currency: Currency = 'UYU',
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const amount = centavosToAmount(centavos);
  const sign = options?.showSign && amount > 0 ? '+' : '';

  if (options?.compact && Math.abs(amount) >= 1000) {
    const k = amount / 1000;
    return `${sign}${currency === 'UYU' ? '$' : 'U$S'} ${k.toFixed(1)}K`;
  }

  const formatted = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const prefix = currency === 'UYU' ? '$' : 'U$S';
  const negSign = amount < 0 ? '-' : '';

  return `${negSign}${sign}${prefix} ${formatted}`;
}

/**
 * Formats a date string to a human-readable format in Spanish.
 */
export function formatDate(dateStr: string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const date = new Date(dateStr);

  if (format === 'short') {
    return date.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
  }
  if (format === 'medium') {
    return date.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return date.toLocaleDateString('es-UY', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns relative time string in Spanish (e.g., "hace 2 días").
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'ahora mismo';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem`;
  return formatDate(dateStr, 'short');
}

/**
 * Returns the month name in Spanish.
 */
export function getMonthName(month: number, short = false): string {
  const date = new Date(2024, month - 1, 1);
  return date.toLocaleDateString('es-UY', { month: short ? 'short' : 'long' });
}

/**
 * Returns a progress bar color based on percentage consumed.
 * teal → amber → rose
 */
export function getBudgetColor(percentage: number): string {
  if (percentage >= 90) return '#f43f5e'; // danger/rose
  if (percentage >= 75) return '#f59e0b'; // warning/amber
  return '#0d9488'; // primary/teal
}

/**
 * Formats XP number with K suffix for large values.
 */
export function formatXP(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
}
