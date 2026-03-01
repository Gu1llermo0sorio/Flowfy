import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

export const documentRouter = Router();
documentRouter.use(authenticate);

/**
 * Document upload and parsing routes.
 * Full implementation in Phase 3 (PDF parsing, OCR, email).
 */

// GET /api/documents — list uploaded documents
documentRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const docs = await prisma.importedDocument.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id
documentRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const { createError } = await import('../middleware/errorHandler');
    const doc = await prisma.importedDocument.findFirst({
      where: { id: req.params['id'], userId: req.userId },
    });
    if (!doc) throw createError('Documento no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});
