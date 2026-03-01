import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';

export const budgetRouter = Router();
budgetRouter.use(authenticate);

const budgetSchema = z.object({
  categoryId: z.string().cuid(),
  amount: z.number().int().positive(),
  currency: z.enum(['UYU', 'USD']).default('UYU'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  userId: z.string().cuid().optional(),
  rollover: z.boolean().optional().default(false),
});

// GET /api/budgets?month=&year=
budgetRouter.get('/', validateQuery(z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const month = req.query['month'] ? parseInt(req.query['month'] as string) : now.getMonth() + 1;
    const year = req.query['year'] ? parseInt(req.query['year'] as string) : now.getFullYear();

    const budgets = await prisma.budget.findMany({
      where: { familyId: req.familyId, month, year },
      include: {
        category: { select: { id: true, nameEs: true, icon: true, color: true } },
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Enrich with current spending per category
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const spending = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        familyId: req.familyId,
        type: 'expense',
        date: { gte: start, lte: end },
      },
      _sum: { amountUYU: true },
    });

    const spendingMap = Object.fromEntries(
      spending.map((s) => [s.categoryId, s._sum.amountUYU ?? 0])
    );

    const enriched = budgets.map((b) => ({
      ...b,
      spent: spendingMap[b.categoryId] ?? 0,
      percentage: Math.round(((spendingMap[b.categoryId] ?? 0) / b.amount) * 100),
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

// POST /api/budgets
budgetRouter.post('/', validate(budgetSchema), async (req: AuthRequest, res, next) => {
  try {
    const data = req.body as z.infer<typeof budgetSchema>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const budget = await prisma.budget.upsert({
      where: {
        familyId_categoryId_userId_month_year: {
          familyId: req.familyId!,
          categoryId: data.categoryId,
          // Prisma compound unique with nullable field requires explicit null
          userId: (data.userId ?? null) as unknown as string,
          month: data.month,
          year: data.year,
        },
      },
      update: { amount: data.amount, rollover: data.rollover ?? false },
      create: { ...data, familyId: req.familyId! },
    });

    res.status(201).json({ success: true, data: budget });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/budgets/:id
budgetRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params['id'], familyId: req.familyId },
    });
    if (!budget) throw createError('Presupuesto no encontrado', 404, 'NOT_FOUND');

    await prisma.budget.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, message: 'Presupuesto eliminado' });
  } catch (err) {
    next(err);
  }
});
