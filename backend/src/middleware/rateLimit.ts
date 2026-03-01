import rateLimit from 'express-rate-limit';

/** Rate limiter for auth endpoints — stricter */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    message: 'Demasiados intentos. Intentá de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API rate limiter */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Por favor esperá un momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
