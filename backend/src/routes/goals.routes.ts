import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { awardXP } from '../services/xp.service';

export const goalRouter = Router();
goalRouter.use(authenticate);

const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['savings', 'debt', 'spending_reduction', 'income']),
  targetAmount: z.number().int().positive(),
  currency: z.enum(['UYU', 'USD']).default('UYU'),
  targetDate: z.string().datetime().optional(),
  userId: z.string().cuid().optional(),
  emoji: z.string().max(10).optional(),
});

const updateGoalSchema = createGoalSchema.partial().extend({
  currentAmount: z.number().int().min(0).optional(),
  isCompleted: z.boolean().optional(),
});

// GET /api/goals
goalRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { familyId: req.familyId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: [{ isCompleted: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: goals });
  } catch (err) {
    next(err);
  }
});

// GET /api/goals/:id
goalRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params['id'], familyId: req.familyId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    if (!goal) throw createError('Meta no encontrada', 404, 'NOT_FOUND');
    res.json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

// POST /api/goals
goalRouter.post('/', validate(createGoalSchema), async (req: AuthRequest, res, next) => {
  try {
    const data = req.body as z.infer<typeof createGoalSchema>;
    const goal = await prisma.goal.create({
      data: {
        ...data,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        familyId: req.familyId!,
      },
    });
    res.status(201).json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/goals/:id
goalRouter.patch('/:id', validate(updateGoalSchema), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params['id'], familyId: req.familyId },
    });
    if (!existing) throw createError('Meta no encontrada', 404, 'NOT_FOUND');

    const data = req.body as z.infer<typeof updateGoalSchema>;

    // Check milestones hit
    const milestones = [...(existing.milestones as number[])];
    if (data.currentAmount !== undefined && existing.targetAmount > 0) {
      const pct = Math.floor((data.currentAmount / existing.targetAmount) * 100);
      for (const threshold of [25, 50, 75, 100]) {
        if (pct >= threshold && !milestones.includes(threshold)) {
          milestones.push(threshold);
          if (threshold === 100) {
            // Award XP for completing goal
            await awardXP(req.userId!, 'COMPLETE_GOAL', req.familyId!);
          } else {
            await awardXP(req.userId!, 'SAVINGS_MILESTONE', req.familyId!);
          }
        }
      }
    }

    const updated = await prisma.goal.update({
      where: { id: req.params['id'] },
      data: {
        ...data,
        milestones,
        ...(data.targetDate && { targetDate: new Date(data.targetDate) }),
        ...(data.isCompleted && !existing.isCompleted && { completedAt: new Date() }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/goals/:id
goalRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params['id'], familyId: req.familyId },
    });
    if (!existing) throw createError('Meta no encontrada', 404, 'NOT_FOUND');

    await prisma.goal.delete({ where: { id: req.params['id'] } });
    res.json({ success: true, message: 'Meta eliminada' });
  } catch (err) {
    next(err);
  }
});
