import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

export const exchangeRateRouter = Router();
exchangeRateRouter.use(authenticate);

// GET /api/exchange-rates/latest
exchangeRateRouter.get('/latest', async (_req, res, next) => {
  try {
    const rate = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: 'USD', toCurrency: 'UYU' },
      orderBy: { date: 'desc' },
    });

    if (!rate) {
      // Return a fallback rate if none is in DB yet
      res.json({
        success: true,
        data: { rate: 39.0, date: new Date().toISOString(), source: 'fallback' },
      });
      return;
    }

    res.json({ success: true, data: rate });
  } catch (err) {
    next(err);
  }
});

// GET /api/exchange-rates/history?days=7
exchangeRateRouter.get('/history', async (req, res, next) => {
  try {
    const days = parseInt((req.query['days'] as string) ?? '7');
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rates = await prisma.exchangeRate.findMany({
      where: { fromCurrency: 'USD', toCurrency: 'UYU', date: { gte: from } },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: rates });
  } catch (err) {
    next(err);
  }
});
