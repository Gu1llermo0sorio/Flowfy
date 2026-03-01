import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const notificationRouter = Router();
notificationRouter.use(authenticate);

// GET /api/notifications
notificationRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
notificationRouter.patch('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params['id'], userId: req.userId },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all
notificationRouter.patch('/read-all', async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
