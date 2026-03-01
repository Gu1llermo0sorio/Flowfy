import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

export const advisorRouter = Router();
advisorRouter.use(authenticate);

/**
 * AI Financial Advisor chat endpoint.
 * Full implementation in Phase 4 (Claude API integration).
 */

// POST /api/advisor/chat
advisorRouter.post('/chat', async (_req: AuthRequest, res) => {
  res.status(503).json({
    success: false,
    message: 'El asesor de IA estará disponible en la Fase 4 del desarrollo.',
  });
});

// GET /api/advisor/recommendations
advisorRouter.get('/recommendations', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const recommendations = await prisma.recommendation.findMany({
      where: { familyId: req.familyId, isDismissed: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ success: true, data: recommendations });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/advisor/recommendations/:id/dismiss
advisorRouter.patch('/recommendations/:id/dismiss', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    await prisma.recommendation.updateMany({
      where: { id: req.params['id'], familyId: req.familyId },
      data: { isDismissed: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
