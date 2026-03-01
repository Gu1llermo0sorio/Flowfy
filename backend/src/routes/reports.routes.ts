import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

const monthlyQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  months: z.coerce.number().int().min(1).max(24).optional().default(12),
  currency: z.enum(['UYU', 'USD']).optional().default('UYU'),
});

// ── GET /api/reports/monthly — monthly income/expense/savings for past N months ──
reportsRouter.get('/monthly', validateQuery(monthlyQuerySchema), async (req: AuthRequest, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof monthlyQuerySchema>;
    const months = q.months ?? 12;

    const rows = await prisma.$queryRaw<
      Array<{ year: number; month: number; income: bigint; expense: bigint }>
    >`
      SELECT
        EXTRACT(YEAR  FROM date)::int AS year,
        EXTRACT(MONTH FROM date)::int AS month,
        SUM(CASE WHEN type = 'income'  THEN "amountUYU" ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN "amountUYU" ELSE 0 END) AS expense
      FROM "Transaction"
      WHERE "familyId" = ${req.familyId}
        AND date >= NOW() - INTERVAL '1 month' * ${months}
      GROUP BY year, month
      ORDER BY year, month
    `;

    const data = rows.map((r) => ({
      year: r.year,
      month: r.month,
      label: new Date(r.year, r.month - 1).toLocaleDateString('es-UY', { month: 'short' }) + ' ' + r.year,
      income: Number(r.income) / 100,
      expense: Number(r.expense) / 100,
      savings: (Number(r.income) - Number(r.expense)) / 100,
      savingsRate: Number(r.income) > 0
        ? Math.round(((Number(r.income) - Number(r.expense)) / Number(r.income)) * 100)
        : 0,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/by-category — spending by category for a period ──────────
const byCategoryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(['income', 'expense']).optional().default('expense'),
});

reportsRouter.get('/by-category', validateQuery(byCategoryQuerySchema), async (req: AuthRequest, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof byCategoryQuerySchema>;

    const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to   = q.to   ? new Date(q.to)   : new Date();

    const txns = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        familyId: req.familyId!,
        type: q.type,
        date: { gte: from, lte: to },
      },
      _sum: { amountUYU: true },
    });

    if (!txns.length) { res.json({ success: true, data: [] }); return; }

    const catIds = txns.map((t) => t.categoryId);
    const cats = await prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, nameEs: true, icon: true, color: true },
    });

    const total = txns.reduce((s, t) => s + (t._sum.amountUYU ?? 0), 0);

    const data = txns
      .map((t) => {
        const cat = cats.find((c) => c.id === t.categoryId);
        const amount = (t._sum.amountUYU ?? 0) / 100;
        return {
          categoryId: t.categoryId,
          name: cat?.nameEs ?? 'Sin categoría',
          icon: cat?.icon ?? '📦',
          color: cat?.color ?? '#64748b',
          amount,
          pct: total > 0 ? Math.round((amount / (total / 100)) * 100) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/savings-rate — monthly savings rate trend ────────────────
reportsRouter.get('/savings-rate', async (req: AuthRequest, res, next) => {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ year: number; month: number; income: bigint; expense: bigint }>
    >`
      SELECT
        EXTRACT(YEAR  FROM date)::int AS year,
        EXTRACT(MONTH FROM date)::int AS month,
        SUM(CASE WHEN type = 'income'  THEN "amountUYU" ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN "amountUYU" ELSE 0 END) AS expense
      FROM "Transaction"
      WHERE "familyId" = ${req.familyId}
        AND date >= NOW() - INTERVAL '12 months'
      GROUP BY year, month
      ORDER BY year, month
    `;

    const data = rows.map((r) => ({
      label: new Date(r.year, r.month - 1).toLocaleDateString('es-UY', { month: 'short', year: '2-digit' }),
      savingsRate: Number(r.income) > 0
        ? Math.round(((Number(r.income) - Number(r.expense)) / Number(r.income)) * 100)
        : 0,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/summary — quick totals (current month + YTD) ─────────────
reportsRouter.get('/summary', async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    const [month, ytd] = await Promise.all([
      prisma.transaction.aggregate({
        where: { familyId: req.familyId!, date: { gte: monthStart } },
        _sum: {
          amountUYU: true,
        },
        // Prisma doesn't allow conditional sum in aggregate, so do two queries
      }),
      prisma.transaction.aggregate({
        where: { familyId: req.familyId!, date: { gte: yearStart } },
        _sum: { amountUYU: true },
      }),
    ]);

    // Fetch income/expense separately
    const [monthIncome, monthExpense, ytdIncome, ytdExpense] = await Promise.all([
      prisma.transaction.aggregate({ where: { familyId: req.familyId!, type: 'income',  date: { gte: monthStart } }, _sum: { amountUYU: true } }),
      prisma.transaction.aggregate({ where: { familyId: req.familyId!, type: 'expense', date: { gte: monthStart } }, _sum: { amountUYU: true } }),
      prisma.transaction.aggregate({ where: { familyId: req.familyId!, type: 'income',  date: { gte: yearStart }  }, _sum: { amountUYU: true } }),
      prisma.transaction.aggregate({ where: { familyId: req.familyId!, type: 'expense', date: { gte: yearStart }  }, _sum: { amountUYU: true } }),
    ]);

    const mInc = (monthIncome._sum.amountUYU ?? 0) / 100;
    const mExp = (monthExpense._sum.amountUYU ?? 0) / 100;
    const yInc = (ytdIncome._sum.amountUYU ?? 0) / 100;
    const yExp = (ytdExpense._sum.amountUYU ?? 0) / 100;

    void month; void ytd;

    res.json({
      success: true,
      data: {
        month: { income: mInc, expense: mExp, savings: mInc - mExp, savingsRate: mInc > 0 ? Math.round(((mInc - mExp) / mInc) * 100) : 0 },
        ytd:   { income: yInc, expense: yExp, savings: yInc - yExp, savingsRate: yInc > 0 ? Math.round(((yInc - yExp) / yInc) * 100) : 0 },
      },
    });
  } catch (err) {
    next(err);
  }
});
