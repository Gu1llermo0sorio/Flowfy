import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';

export const recurringRouter = Router();
recurringRouter.use(authenticate);

const createSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.enum(['UYU', 'USD']),
  description: z.string().min(1).max(255),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().cuid(),
  subcategoryId: z.string().cuid().optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  paymentMethod: z.enum(['cash', 'debit', 'credit', 'transfer', 'other']).optional(),
  notes: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

// ── GET /api/recurring ─────────────────────────────────────────────────────────
recurringRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const recs = await prisma.recurringTransaction.findMany({
      where: { familyId: req.familyId! },
      include: {
        // Note: need to join category manually via raw or include
      } as object,
      orderBy: { nextDate: 'asc' },
    });

    // Manually fetch categories for display
    const catIds = [...new Set(recs.map((r) => r.categoryId))];
    const cats = await prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, nameEs: true, icon: true, color: true },
    });

    const data = recs.map((r) => ({
      ...r,
      category: cats.find((c) => c.id === r.categoryId) ?? null,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/recurring ────────────────────────────────────────────────────────
recurringRouter.post('/', validate(createSchema), async (req: AuthRequest, res, next) => {
  try {
    const data = req.body as z.infer<typeof createSchema>;

    const startDate = new Date(data.startDate);
    // Next date defaults to startDate (first run is on that day)
    const rec = await prisma.recurringTransaction.create({
      data: {
        familyId: req.familyId!,
        userId: req.userId!,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        type: data.type,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId ?? null,
        frequency: data.frequency,
        startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextDate: startDate,
        paymentMethod: data.paymentMethod ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? [],
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: rec });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/recurring/:id ───────────────────────────────────────────────────
recurringRouter.patch('/:id', validate(createSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    const rec = await prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, familyId: req.familyId! },
    });
    if (!rec) throw createError('Recurrente no encontrado', 404, 'NOT_FOUND');

    const body = req.body as Partial<z.infer<typeof createSchema>>;
    const updated = await prisma.recurringTransaction.update({
      where: { id: rec.id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate:   body.endDate   ? new Date(body.endDate)   : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/recurring/:id ──────────────────────────────────────────────────
recurringRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const rec = await prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, familyId: req.familyId! },
    });
    if (!rec) throw createError('Recurrente no encontrado', 404, 'NOT_FOUND');
    await prisma.recurringTransaction.delete({ where: { id: rec.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/recurring/:id/toggle — activate/deactivate ─────────────────────
recurringRouter.patch('/:id/toggle', async (req: AuthRequest, res, next) => {
  try {
    const rec = await prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, familyId: req.familyId! },
    });
    if (!rec) throw createError('Recurrente no encontrado', 404, 'NOT_FOUND');

    const updated = await prisma.recurringTransaction.update({
      where: { id: rec.id },
      data: { isActive: !rec.isActive },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
