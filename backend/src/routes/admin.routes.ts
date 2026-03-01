import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';

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

    const allowed = ['role', 'name'];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) data[k] = req.body[k];
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
