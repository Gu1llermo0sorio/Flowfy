import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getLevelFromXP } from '../services/xp.service';

export const gamificationRouter = Router();
gamificationRouter.use(authenticate);

// GET /api/gamification/my-stats
gamificationRouter.get('/my-stats', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { xp: true, level: true, streakDays: true },
    });
    if (!user) { res.status(404).json({ success: false }); return; }

    const levelInfo = getLevelFromXP(user.xp);
    const badges = await prisma.userBadge.findMany({
      where: { userId: req.userId },
      include: { badge: true },
      orderBy: { unlockedAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        xp: user.xp,
        level: user.level,
        streakDays: user.streakDays,
        levelInfo,
        badges: badges.map((b) => ({ ...b.badge, unlockedAt: b.unlockedAt })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/gamification/badges
gamificationRouter.get('/badges', async (_req, res, next) => {
  try {
    const badges = await prisma.badge.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: badges });
  } catch (err) {
    next(err);
  }
});

// GET /api/gamification/challenges
gamificationRouter.get('/challenges', async (req: AuthRequest, res, next) => {
  try {
    const challenges = await prisma.challenge.findMany({
      where: { familyId: req.familyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: challenges });
  } catch (err) {
    next(err);
  }
});

const createChallengeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  type: z.string().default('custom'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  xpReward: z.number().int().min(1).max(500),
});

// POST /api/gamification/challenges
gamificationRouter.post(
  '/challenges',
  validate(createChallengeSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const data = req.body as z.infer<typeof createChallengeSchema>;
      const challenge = await prisma.challenge.create({
        data: {
          ...data,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          familyId: req.familyId!,
          userId: req.userId,
        },
      });
      res.status(201).json({ success: true, data: challenge });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/gamification/checkin — daily streak check-in
gamificationRouter.patch('/checkin', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { lastActive: true, streakDays: true },
    });
    if (!user) { res.status(404).json({ success: false }); return; }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = user.streakDays;

    if (user.lastActive) {
      const lastActiveDate = new Date(user.lastActive);
      lastActiveDate.setHours(0, 0, 0, 0);
      const nowDate = new Date(now);
      nowDate.setHours(0, 0, 0, 0);
      const yesterdayDate = new Date(yesterday);
      yesterdayDate.setHours(0, 0, 0, 0);

      if (lastActiveDate.getTime() === yesterdayDate.getTime()) {
        newStreak += 1;
      } else if (lastActiveDate.getTime() < yesterdayDate.getTime()) {
        newStreak = 1; // streak broken
      }
      // if same day as today already, don't increment
    } else {
      newStreak = 1;
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { lastActive: now, streakDays: newStreak },
    });

    const { awardXP } = await import('../services/xp.service');
    await awardXP(req.userId!, 'WEEKLY_CHECKIN', req.familyId!);

    res.json({ success: true, data: { streakDays: newStreak } });
  } catch (err) {
    next(err);
  }
});
