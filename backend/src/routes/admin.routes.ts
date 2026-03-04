import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { revokeAllRefreshTokens } from '../lib/tokens';

export const adminRouter = Router();
adminRouter.use(authenticate);

// ── Admin guard middleware ─────────────────────────────────────────────────────
function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.userRole !== 'ADMIN') {
    return next(createError('Acceso restringido a administradores', 403, 'FORBIDDEN'));
  }
  next();
}
adminRouter.use(requireAdmin);

// ── GET /api/admin/stats — global app stats ────────────────────────────────────
adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [userCount, familyCount, transactionCount, documentCount] = await Promise.all([
      prisma.user.count(),
      prisma.family.count(),
      prisma.transaction.count(),
      prisma.importedDocument.count(),
    ]);

    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await prisma.user.count({
      where: { lastActive: { gte: last30Days } },
    });

    const newUsersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: last30Days } },
    });

    res.json({
      success: true,
      data: {
        userCount,
        familyCount,
        transactionCount,
        documentCount,
        activeUsers,
        newUsersThisMonth,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users — list all users ─────────────────────────────────────
adminRouter.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(String(req.query['page'] ?? 1));
    const limit = Math.min(parseInt(String(req.query['limit'] ?? 50)), 100);
    const search = String(req.query['search'] ?? '');

    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          xp: true,
          level: true,
          streakDays: true,
          lastActive: true,
          createdAt: true,
          family: { select: { id: true, name: true } },
          _count: { select: { transactions: true, goals: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: { users, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/users/:id — update role / ban user ───────────────────────
adminRouter.patch('/users/:id', async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params['id'];
    if (targetId === req.userId) {
      throw createError('No podés modificar tu propio rol', 400, 'BAD_REQUEST');
    }

    const VALID_ROLES = ['owner', 'partner', 'ADMIN', 'banned'];
    const allowed = ['role', 'name'];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        if (k === 'role' && !VALID_ROLES.includes(req.body[k])) {
          throw createError(`Rol inválido. Roles permitidos: ${VALID_ROLES.join(', ')}`, 400, 'VALIDATION_ERROR');
        }
        data[k] = req.body[k];
      }
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data,
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/admin/users/:id — delete user ─────────────────────────────────
adminRouter.delete('/users/:id', async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params['id'];
    if (targetId === req.userId) {
      throw createError('No podés eliminar tu propia cuenta desde el panel admin', 400, 'BAD_REQUEST');
    }
    await prisma.user.delete({ where: { id: targetId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/activity — recent transactions across all users ─────────────
adminRouter.get('/activity', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query['limit'] ?? 50)), 200);
    const transactions = await prisma.transaction.findMany({
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        description: true,
        date: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        category: { select: { nameEs: true, icon: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ success: true, data: transactions });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/users/:id/ban — ban or unban user ───────────────────────
adminRouter.patch('/users/:id/ban', async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params['id'];
    if (targetId === req.userId) {
      throw createError('No podés banearte a vos mismo', 400, 'BAD_REQUEST');
    }
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
    if (!user) throw createError('Usuario no encontrado', 404, 'NOT_FOUND');

    if (user.role === 'ADMIN') throw createError('No podés banear a otro administrador', 400, 'BAD_REQUEST');

    const newRole = user.role === 'banned' ? 'owner' : 'banned';
    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { role: newRole },
      select: { id: true, email: true, name: true, role: true },
    });

    // If banning, revoke all sessions
    if (newRole === 'banned') await revokeAllRefreshTokens(targetId);

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/admin/users/:id/sessions — revoke all refresh tokens ──────────
adminRouter.delete('/users/:id/sessions', async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params['id'];
    await revokeAllRefreshTokens(targetId);
    res.json({ success: true, message: 'Todas las sesiones del usuario fueron revocadas.' });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/users/:id/reset-password — admin force-reset password ───
adminRouter.patch('/users/:id/reset-password', async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params['id'];
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || newPassword.length < 8) {
      throw createError('La contraseña debe tener al menos 8 caracteres', 400, 'VALIDATION_ERROR');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: targetId }, data: { passwordHash } });
    await revokeAllRefreshTokens(targetId);
    res.json({ success: true, message: 'Contraseña reseteada. Las sesiones del usuario fueron cerradas.' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/families — list all families ───────────────────────────────
adminRouter.get('/families', async (_req, res, next) => {
  try {
    const families = await prisma.family.findMany({
      include: {
        _count: { select: { users: true, transactions: true } },
        users: { select: { id: true, name: true, email: true, role: true, lastActive: true, createdAt: true, xp: true, level: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: families });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/logs — system event logs ────────────────────────────────────
adminRouter.get('/logs', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query['limit'] ?? 100)), 500);

    const [recentUsers, recentImports] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, name: true, email: true, role: true, familyId: true, createdAt: true, lastActive: true, family: { select: { name: true } } },
      }),
      prisma.transaction.findMany({
        where: { importSource: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, description: true, amount: true, amountUYU: true, currency: true,
          importSource: true, importBatchId: true, createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          family: { select: { name: true } },
        },
      }),
    ]);

    // Group imports by batch
    const batchMap = new Map<string, typeof recentImports>();
    for (const tx of recentImports) {
      if (!tx.importBatchId) continue;
      const arr = batchMap.get(tx.importBatchId) ?? [];
      arr.push(tx);
      batchMap.set(tx.importBatchId, arr);
    }

    const importEvents = Array.from(batchMap.entries()).map(([batchId, txs]) => ({
      type: 'import' as const,
      batchId,
      count: txs.length,
      totalAmountUYU: txs.reduce((s, t) => s + (t.amountUYU ?? 0), 0),
      importSource: txs[0]?.importSource,
      user: txs[0]?.user,
      family: txs[0]?.family,
      createdAt: txs[0]?.createdAt,
    })).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, 50);

    const registrationEvents = recentUsers.map((u) => ({
      type: 'registration' as const,
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      familyName: u.family?.name,
      createdAt: u.createdAt,
      lastActive: u.lastActive,
    }));

    res.json({ success: true, data: { registrations: registrationEvents, imports: importEvents } });
  } catch (err) {
    next(err);
  }
});
