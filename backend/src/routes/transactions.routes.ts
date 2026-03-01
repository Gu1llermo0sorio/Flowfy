import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { awardXP } from '../services/xp.service';

export const transactionRouter = Router();
transactionRouter.use(authenticate);

// ── Schemas ────────────────────────────────────────────────────────────────────
const createTransactionSchema = z.object({
  amount: z.number().int().positive('El monto debe ser positivo'),
  currency: z.enum(['UYU', 'USD']),
  description: z.string().min(1).max(255),
  date: z.string().datetime(),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().cuid(),
  subcategoryId: z.string().cuid().optional(),
  paymentMethod: z
    .enum(['cash', 'debit', 'credit', 'transfer', 'other'])
    .optional(),
  notes: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  receiptUrl: z.string().url().optional(),
  isRecurring: z.boolean().optional().default(false),
});

const updateTransactionSchema = createTransactionSchema.partial();

const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(['income', 'expense']).optional(),
  categoryId: z.string().optional(),
  userId: z.string().optional(),
  currency: z.enum(['UYU', 'USD']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  sortBy: z.enum(['date', 'amount', 'createdAt']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ── GET /api/transactions ──────────────────────────────────────────────────────
transactionRouter.get(
  '/',
  validateQuery(listTransactionsQuerySchema),
  async (req: AuthRequest, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof listTransactionsQuerySchema>;
      const skip = (q.page - 1) * q.limit;

      const where: Record<string, unknown> = { familyId: req.familyId };
      if (q.type) where.type = q.type;
      if (q.categoryId) where.categoryId = q.categoryId;
      if (q.userId) where.userId = q.userId;
      if (q.currency) where.currency = q.currency;
      if (q.tags) where.tags = { hasSome: q.tags.split(',') };
      if (q.search) where.description = { contains: q.search, mode: 'insensitive' };
      if (q.from || q.to) {
        where.date = {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to) } : {}),
        };
      }
      if (q.minAmount || q.maxAmount) {
        where.amountUYU = {
          ...(q.minAmount ? { gte: Math.round(q.minAmount * 100) } : {}),
          ...(q.maxAmount ? { lte: Math.round(q.maxAmount * 100) } : {}),
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prismaWhere = where as any;
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: prismaWhere,
          include: {
            category: { select: { id: true, nameEs: true, icon: true, color: true } },
            subcategory: { select: { id: true, nameEs: true, icon: true } },
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { [q.sortBy]: q.sortOrder },
          skip,
          take: q.limit,
        }),
        prisma.transaction.count({ where: prismaWhere }),
      ]);

      res.json({
        success: true,
        data: transactions,
        meta: {
          total,
          page: q.page,
          limit: q.limit,
          totalPages: Math.ceil(total / q.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/transactions/:id ──────────────────────────────────────────────────
transactionRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const tx = await prisma.transaction.findFirst({
      where: { id: req.params['id'], familyId: req.familyId },
      include: {
        category: true,
        subcategory: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
    if (!tx) throw createError('Transacción no encontrada', 404, 'NOT_FOUND');
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/transactions ─────────────────────────────────────────────────────
transactionRouter.post(
  '/',
  validate(createTransactionSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const data = req.body as z.infer<typeof createTransactionSchema>;

      // Get current exchange rate if USD
      let amountUYU = data.amount;
      let exchangeRateUsed: number | undefined;

      if (data.currency === 'USD') {
        const rate = await prisma.exchangeRate.findFirst({
          where: { fromCurrency: 'USD', toCurrency: 'UYU' },
          orderBy: { date: 'desc' },
        });
        if (rate) {
          exchangeRateUsed = rate.rate;
          amountUYU = Math.round(data.amount * rate.rate);
        } else {
          // Fallback rate
          exchangeRateUsed = 3900;
          amountUYU = Math.round(data.amount * 3900);
        }
      }

      const tx = await prisma.transaction.create({
        data: {
          amount: data.amount,
          currency: data.currency,
          amountUYU,
          exchangeRateUsed,
          description: data.description,
          date: new Date(data.date),
          type: data.type,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId,
          userId: req.userId!,
          familyId: req.familyId!,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          tags: data.tags ?? [],
          receiptUrl: data.receiptUrl,
          isRecurring: data.isRecurring ?? false,
          importSource: 'manual',
        },
        include: {
          category: { select: { id: true, nameEs: true, icon: true, color: true } },
          subcategory: { select: { id: true, nameEs: true, icon: true } },
        },
      });

      // Award XP for logging a transaction
      await awardXP(req.userId!, 'LOG_TRANSACTION', req.familyId!);

      res.status(201).json({ success: true, data: tx });
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/transactions/:id ────────────────────────────────────────────────
transactionRouter.patch(
  '/:id',
  validate(updateTransactionSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const existing = await prisma.transaction.findFirst({
        where: { id: req.params['id'], familyId: req.familyId },
      });
      if (!existing) throw createError('Transacción no encontrada', 404, 'NOT_FOUND');

      const data = req.body as z.infer<typeof updateTransactionSchema>;

      let amountUYU = data.amount ?? existing.amount;
      if (data.currency === 'USD' || (existing.currency === 'USD' && !data.currency)) {
        const rate = await prisma.exchangeRate.findFirst({
          where: { fromCurrency: 'USD', toCurrency: 'UYU' },
          orderBy: { date: 'desc' },
        });
        const rateValue = rate?.rate ?? 3900;
        amountUYU = Math.round((data.amount ?? existing.amount) * rateValue);
      }

      const updated = await prisma.transaction.update({
        where: { id: req.params['id'] },
        data: {
          ...data,
          ...(data.amount !== undefined && { amountUYU }),
          ...(data.date !== undefined && { date: new Date(data.date) }),
        },
        include: {
          category: { select: { id: true, nameEs: true, icon: true, color: true } },
          subcategory: { select: { id: true, nameEs: true, icon: true } },
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/transactions/:id ───────────────────────────────────────────────
transactionRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params['id'], familyId: req.familyId },
    });
    if (!existing) throw createError('Transacción no encontrada', 404, 'NOT_FOUND');

    await prisma.transaction.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, message: 'Transacción eliminada exitosamente' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/transactions/summary/monthly ─────────────────────────────────────
transactionRouter.get('/summary/monthly', async (req: AuthRequest, res, next) => {
  try {
    const { year, month } = req.query as { year?: string; month?: string };
    const now = new Date();
    const y = year ? parseInt(year) : now.getFullYear();
    const m = month ? parseInt(month) : now.getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        familyId: req.familyId,
        date: { gte: start, lte: end },
      },
      select: {
        type: true,
        amountUYU: true,
        categoryId: true,
        category: { select: { nameEs: true, icon: true, color: true } },
      },
    });

    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountUYU, 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountUYU, 0);

    const byCategory: Record<string, { amount: number; name: string; icon: string; color: string }> =
      {};
    for (const t of transactions.filter((t) => t.type === 'expense')) {
      if (!byCategory[t.categoryId]) {
        byCategory[t.categoryId] = {
          amount: 0,
          name: t.category.nameEs,
          icon: t.category.icon,
          color: t.category.color,
        };
      }
      byCategory[t.categoryId].amount += t.amountUYU;
    }

    res.json({
      success: true,
      data: {
        year: y,
        month: m,
        income,
        expenses,
        savings: income - expenses,
        savingsRate: income > 0 ? Math.round(((income - expenses) / income) * 100) : 0,
        byCategory: Object.entries(byCategory)
          .map(([id, v]) => ({ categoryId: id, ...v }))
          .sort((a, b) => b.amount - a.amount),
      },
    });
  } catch (err) {
    next(err);
  }
});
