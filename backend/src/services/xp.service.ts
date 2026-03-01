import { prisma } from '../lib/prisma';

/**
 * XP rewards for different user actions.
 */
const XP_REWARDS: Record<string, number> = {
  LOG_TRANSACTION: 10,
  UPLOAD_RECEIPT: 15,
  WEEKLY_CHECKIN: 25,
  STAY_UNDER_BUDGET: 50,
  SAVINGS_MILESTONE: 100,
  FULL_MONTH_UNDER_BUDGET: 200,
  FIX_BAD_HABIT: 150,
  FOLLOW_AI_RECOMMENDATION: 30,
  IMPORT_BANK_STATEMENT: 20,
  COMPLETE_GOAL: 150,
  COMPLETE_CHALLENGE: 75,
};

/**
 * Level thresholds (XP required).
 */
const LEVELS = [
  { level: 1, xp: 0, title: '🌱 Semilla Financiera' },
  { level: 2, xp: 500, title: '💰 Principiante Presupuestario' },
  { level: 3, xp: 1500, title: '📊 Aprendiz de Finanzas' },
  { level: 4, xp: 3000, title: '🎯 Definidor de Metas' },
  { level: 5, xp: 5000, title: '💎 Campeón del Ahorro' },
  { level: 6, xp: 8000, title: '🚀 Constructor de Riqueza' },
  { level: 7, xp: 12000, title: '👑 Maestro Financiero' },
  { level: 8, xp: 20000, title: '🏆 Leyenda del Dinero' },
];

export function getLevelFromXP(xp: number): { level: number; title: string; nextLevelXP: number | null; progress: number } {
  let current = LEVELS[0];
  let next: (typeof LEVELS)[0] | null = null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
    }
  }

  const progress = next
    ? Math.round(((xp - current.xp) / (next.xp - current.xp)) * 100)
    : 100;

  return {
    level: current.level,
    title: current.title,
    nextLevelXP: next?.xp ?? null,
    progress,
  };
}

/**
 * Awards XP to a user for an action.
 * Checks for level-up and creates a notification if so.
 * @returns The amount of XP awarded.
 */
export async function awardXP(
  userId: string,
  action: keyof typeof XP_REWARDS,
  familyId: string
): Promise<number> {
  const xpAmount = XP_REWARDS[action] ?? 0;
  if (xpAmount === 0) return 0;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true },
  });
  if (!user) return 0;

  const newXP = user.xp + xpAmount;
  const oldLevel = user.level;
  const { level: newLevel } = getLevelFromXP(newXP);

  await prisma.user.update({
    where: { id: userId },
    data: { xp: newXP, level: newLevel },
  });

  // Create level-up notification
  if (newLevel > oldLevel) {
    const levelData = LEVELS.find((l) => l.level === newLevel);
    await prisma.notification.create({
      data: {
        userId,
        type: 'level_up',
        title: `¡Subiste al nivel ${newLevel}!`,
        body: `Ahora sos ${levelData?.title ?? `Nivel ${newLevel}`}. ¡Seguí así!`,
        metadata: { newLevel, oldLevel, xpTotal: newXP },
      },
    });
  }

  // Check badge progress
  await checkBadges(userId, familyId);

  return xpAmount;
}

/**
 * Checks and awards badges based on user/family stats.
 */
async function checkBadges(userId: string, familyId: string): Promise<void> {
  try {
    const [user, txCount, receiptCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { streakDays: true, xp: true },
      }),
      prisma.transaction.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId, receiptUrl: { not: null } } }),
    ]);

    if (!user) return;

    const badgesToCheck = [
      { code: 'on_fire', condition: user.streakDays >= 7 },
      { code: 'iron_will', condition: user.streakDays >= 30 },
      { code: 'receipt_hoarder', condition: receiptCount >= 50 },
    ];

    for (const { code, condition } of badgesToCheck) {
      if (!condition) continue;

      const badge = await prisma.badge.findUnique({ where: { code } });
      if (!badge) continue;

      const alreadyUnlocked = await prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
      });
      if (alreadyUnlocked) continue;

      await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
      await prisma.notification.create({
        data: {
          userId,
          type: 'badge',
          title: `¡Nueva insignia desbloqueada!`,
          body: `Ganaste la insignia "${badge.nameEs}" ${badge.icon}`,
          metadata: { badgeId: badge.id, badgeCode: code },
        },
      });

      // Award XP for the badge
      if (badge.xpReward > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: badge.xpReward } },
        });
      }
    }
  } catch {
    // Badge checking should never break the main flow
  }
}
