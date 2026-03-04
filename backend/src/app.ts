import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { familyRouter } from './routes/family.routes';
import { transactionRouter } from './routes/transactions.routes';
import { categoryRouter } from './routes/categories.routes';
import { budgetRouter } from './routes/budgets.routes';
import { goalRouter } from './routes/goals.routes';
import { documentRouter } from './routes/documents.routes';
import { advisorRouter } from './routes/advisor.routes';
import { gamificationRouter } from './routes/gamification.routes';
import { notificationRouter } from './routes/notifications.routes';
import { exchangeRateRouter } from './routes/exchangeRate.routes';
import { adminRouter } from './routes/admin.routes';
import { reportsRouter } from './routes/reports.routes';
import { recurringRouter } from './routes/recurring.routes';
import { importRouter } from './routes/import.routes';
import { errorHandler } from './middleware/errorHandler';
import { authLimiter, generalLimiter } from './middleware/rateLimit';

export const app = express();

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(generalLimiter);

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), app: 'Flowfy API' });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/family', familyRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/budgets', budgetRouter);
app.use('/api/goals', goalRouter);
app.use('/api/documents', documentRouter);
app.use('/api/advisor', advisorRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/exchange-rates', exchangeRateRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/recurring', recurringRouter);
app.use('/api/import', importRouter);
// Protect uploads with authentication
app.use('/uploads', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }
  next();
}, express.static('uploads', { maxAge: '7d' }));

// ── Error handler (must be last) ───────────────────────────────────────────────
app.use(errorHandler);
