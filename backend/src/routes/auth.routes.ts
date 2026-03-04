import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  generateAccessToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from '../lib/tokens';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { seedDefaultCategories } from '../services/categories.service';

export const authRouter = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(50),
  familyName: z.string().min(2, 'El nombre de familia debe tener al menos 2 caracteres').max(50),
  partnerEmail: z.string().email('Email de pareja inválido').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  rememberMe: z.boolean().optional().default(false),
});

const addPartnerSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2).max(50),
  password: z.string().min(8).max(128),
});

// ── Helper: set refresh token cookie ──────────────────────────────────────────
function setRefreshCookie(res: Response, token: string, rememberMe = false): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    // 'none' required for cross-site (Surge → Railway). 'lax' for local dev.
    sameSite: isProd ? 'none' : 'lax',
    maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined, // session cookie if not remember
    path: '/api/auth',
  });
}

// ── POST /api/auth/register ────────────────────────────────────────────────────
authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, familyName } = req.body as z.infer<typeof registerSchema>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw createError('Ya existe una cuenta con ese email', 409, 'EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const family = await tx.family.create({ data: { name: familyName } });
      const user = await tx.user.create({
        data: { email, passwordHash, name, familyId: family.id, role: 'owner' },
      });
      return { family, user };
    });

    // Seed default categories for the new family
    await seedDefaultCategories(result.family.id);

    const accessToken = generateAccessToken({
      userId: result.user.id,
      familyId: result.family.id,
      role: result.user.role,
    });
    const refreshToken = await createRefreshToken(result.user.id);

    setRefreshCookie(res, refreshToken, false);

    res.status(201).json({
      success: true,
      message: '¡Bienvenido a Flowfy! Tu cuenta fue creada exitosamente.',
      accessToken,
      refreshToken, // also in body for Safari ITP fallback
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        familyId: result.family.id,
        familyName: result.family.name,
        xp: result.user.xp,
        level: result.user.level,
        streakDays: result.user.streakDays,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────
authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { family: { select: { id: true, name: true, currency: true } } },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw createError('Email o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
    }

    if (user.role === 'banned') {
      throw createError('Esta cuenta ha sido suspendida. Contactá al administrador.', 403, 'ACCOUNT_BANNED');
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    const accessToken = generateAccessToken({
      userId: user.id,
      familyId: user.familyId,
      role: user.role,
    });
    const refreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, refreshToken, rememberMe);

    res.json({
      success: true,
      message: `¡Hola, ${user.name}!`,
      accessToken,
      refreshToken, // also in body for Safari ITP fallback
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        familyId: user.familyId,
        familyName: user.family.name,
        familyCurrency: user.family.currency,
        xp: user.xp,
        level: user.level,
        streakDays: user.streakDays,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/refresh ─────────────────────────────────────────────────────
authRouter.post('/refresh', async (req, res, next) => {
  try {
    // Accept token from cookie (standard) OR from body (Safari ITP fallback)
    const token: string | undefined = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (!token) throw createError('Refresh token requerido', 401, 'NO_REFRESH_TOKEN');

    const user = await validateRefreshToken(token);
    if (!user) throw createError('Refresh token inválido o expirado', 401, 'INVALID_REFRESH_TOKEN');

    // Rotate refresh token
    await revokeRefreshToken(token);
    const newRefreshToken = await createRefreshToken(user.id);
    const newAccessToken = generateAccessToken({
      userId: user.id,
      familyId: user.familyId,
      role: user.role,
    });

    setRefreshCookie(res, newRefreshToken, true);

    // Also return new refresh token in body so client can update localStorage
    res.json({ success: true, accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────────
authRouter.post('/logout', async (req, res, next) => {
  try {
    // Accept token from cookie OR body (Safari ITP fallback)
    const token: string | undefined = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (token) await revokeRefreshToken(token);

    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ success: true, message: 'Sesión cerrada exitosamente.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout-all ──────────────────────────────────────────────────
authRouter.post('/logout-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await revokeAllRefreshTokens(req.userId!);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ success: true, message: 'Todas las sesiones fueron cerradas.' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        family: { select: { id: true, name: true, currency: true } },
        userBadges: { include: { badge: true }, orderBy: { unlockedAt: 'desc' } },
      },
    });

    if (!user) throw createError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        familyId: user.familyId,
        familyName: user.family.name,
        familyCurrency: user.family.currency,
        xp: user.xp,
        level: user.level,
        streakDays: user.streakDays,
        lastActive: user.lastActive,
        badges: user.userBadges.map((ub: { badge: object; unlockedAt: Date }) => ({
          ...ub.badge,
          unlockedAt: ub.unlockedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(128),
});

authRouter.post('/change-password', authenticate, validate(changePasswordSchema), async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw createError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw createError('La contraseña actual es incorrecta', 400, 'WRONG_PASSWORD');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId! }, data: { passwordHash } });

    // Revoke all other sessions so attacker can't stay logged in
    await revokeAllRefreshTokens(req.userId!);

    res.json({ success: true, message: 'Contraseña actualizada. Vas a ser deslogueado automáticamente de otras sesiones.' });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/auth/profile — update name and/or email ────────────────────────
const updateAuthProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email('Email inválido').optional(),
});

authRouter.patch('/profile', authenticate, validate(updateAuthProfileSchema), async (req: AuthRequest, res, next) => {
  try {
    const { name, email } = req.body as z.infer<typeof updateAuthProfileSchema>;

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.userId) {
        throw createError('Ya existe una cuenta con ese email', 409, 'EMAIL_TAKEN');
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId! },
      data: { ...(name && { name }), ...(email && { email }) },
      select: { id: true, name: true, email: true, avatar: true, role: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/add-partner ─────────────────────────────────────────────────
authRouter.post(
  '/add-partner',
  authenticate,
  validate(addPartnerSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { email, name, password } = req.body as z.infer<typeof addPartnerSchema>;

      // Check there's no partner yet
      const existingPartner = await prisma.user.findFirst({
        where: { familyId: req.familyId, role: 'partner' },
      });
      if (existingPartner) {
        throw createError('Esta familia ya tiene una pareja registrada', 409, 'PARTNER_EXISTS');
      }

      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        throw createError('Ya existe una cuenta con ese email', 409, 'EMAIL_TAKEN');
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const partner = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          familyId: req.familyId!,
          role: 'partner',
        },
      });

      res.status(201).json({
        success: true,
        message: `¡${name} fue agregado/a como pareja!`,
        partner: {
          id: partner.id,
          email: partner.email,
          name: partner.name,
          role: partner.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
