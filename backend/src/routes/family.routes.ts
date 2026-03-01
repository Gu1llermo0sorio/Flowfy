import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';

export const familyRouter = Router();
familyRouter.use(authenticate);

const updateFamilySchema = z.object({
  name: z.string().min(2).max(50).optional(),
  currency: z.enum(['UYU', 'USD']).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  avatar: z.string().max(255).optional(),
});

// GET /api/family — get current family with all members
familyRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const family = await prisma.family.findUnique({
      where: { id: req.familyId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            xp: true,
            level: true,
            streakDays: true,
            lastActive: true,
          },
        },
      },
    });
    if (!family) throw createError('Familia no encontrada', 404, 'NOT_FOUND');
    res.json({ success: true, data: family });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/family — update family settings
familyRouter.patch('/', validate(updateFamilySchema), async (req: AuthRequest, res, next) => {
  try {
    const updated = await prisma.family.update({
      where: { id: req.familyId },
      data: req.body,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/family/members
familyRouter.get('/members', async (req: AuthRequest, res, next) => {
  try {
    const members = await prisma.user.findMany({
      where: { familyId: req.familyId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        xp: true,
        level: true,
        streakDays: true,
        lastActive: true,
        userBadges: {
          include: { badge: true },
          orderBy: { unlockedAt: 'desc' },
          take: 5,
        },
      },
    });
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/family/profile — update current user profile
familyRouter.patch('/profile', validate(updateProfileSchema), async (req: AuthRequest, res, next) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: req.body,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        xp: true,
        level: true,
        streakDays: true,
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/family/leaderboard — weekly XP leaderboard
familyRouter.get('/leaderboard', async (req: AuthRequest, res, next) => {
  try {
    const members = await prisma.user.findMany({
      where: { familyId: req.familyId },
      select: {
        id: true,
        name: true,
        avatar: true,
        xp: true,
        level: true,
        streakDays: true,
      },
      orderBy: { xp: 'desc' },
    });
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
});
