import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
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

// ── POST /api/family/invite — generate invitation link (owner only) ─────────────
familyRouter.post('/invite', async (req: AuthRequest, res, next) => {
  try {
    const email = (req.body?.email as string | undefined) ?? undefined;
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.familyInvitation.create({
      data: {
        familyId: req.familyId!,
        token,
        email: email ?? null,
        expiresAt,
        createdBy: req.userId!,
      },
    });

    const baseUrl = process.env.FRONTEND_URL ?? 'https://flowfy.surge.sh';
    const link = `${baseUrl}/join/${invite.token}`;

    res.status(201).json({ success: true, data: { token: invite.token, link, expiresAt } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/family/invitations — list active invites for this family ─────────
familyRouter.get('/invitations', async (req: AuthRequest, res, next) => {
  try {
    const invites = await prisma.familyInvitation.findMany({
      where: { familyId: req.familyId!, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    const baseUrl = process.env.FRONTEND_URL ?? 'https://flowfy.surge.sh';
    const data = invites.map((inv) => ({
      ...inv,
      link: `${baseUrl}/join/${inv.token}`,
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/family/invitations/:token — revoke invitation ─────────────────
familyRouter.delete('/invitations/:token', async (req: AuthRequest, res, next) => {
  try {
    const invite = await prisma.familyInvitation.findFirst({
      where: { token: req.params.token, familyId: req.familyId! },
    });
    if (!invite) throw createError('Invitación no encontrada', 404, 'NOT_FOUND');
    await prisma.familyInvitation.delete({ where: { id: invite.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/family/data — wipe all financial data (owner only) ────────────
familyRouter.delete('/data', async (req: AuthRequest, res, next) => {
  try {
    // Only owner can clear data
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
    if (user?.role !== 'owner') throw createError('Solo el propietario puede limpiar los datos', 403, 'FORBIDDEN');

    const fid = req.familyId!;

    // Delete everything financial — keep categories, users, family config, invitations
    const [txDel, budDel, goalDel, chalDel, recDel] = await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { familyId: fid } }),
      prisma.budget.deleteMany({ where: { familyId: fid } }),
      prisma.goal.deleteMany({ where: { familyId: fid } }),
      prisma.challenge.deleteMany({ where: { familyId: fid } }),
      prisma.recommendation.deleteMany({ where: { familyId: fid } }),
    ]);

    // Reset XP + streaks for all members
    await prisma.user.updateMany({
      where: { familyId: fid },
      data: { xp: 0, level: 1, streakDays: 0 },
    });

    const total = txDel.count + budDel.count + goalDel.count + chalDel.count + recDel.count;
    res.json({ success: true, data: { deleted: total, transactions: txDel.count, budgets: budDel.count, goals: goalDel.count } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/family/join/:token — validate an invitation (no auth needed) ─────
familyRouter.get('/join/:token', async (_req, res, next) => {
  try {
    const inv = await prisma.familyInvitation.findUnique({
      where: { token: _req.params.token },
      include: { family: { select: { id: true, name: true } } },
    });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) {
      throw createError('Invitación inválida o expirada', 410, 'INVITATION_EXPIRED');
    }
    res.json({ success: true, data: { familyName: inv.family.name, email: inv.email, token: inv.token } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/family/join/:token — accept invitation (requires auth) ──────────
familyRouter.post('/join/:token', async (req: AuthRequest, res, next) => {
  try {
    const inv = await prisma.familyInvitation.findUnique({
      where: { token: req.params.token },
    });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) {
      throw createError('Invitación inválida o expirada', 410, 'INVITATION_EXPIRED');
    }

    // Move user to the invited family
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId! },
        data: { familyId: inv.familyId, role: inv.role },
      }),
      prisma.familyInvitation.update({
        where: { id: inv.id },
        data: { usedAt: new Date() },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, name: true, email: true, familyId: true, role: true },
    });

    res.json({ success: true, data: updatedUser });
  } catch (err) {
    next(err);
  }
});
