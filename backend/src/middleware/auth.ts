import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  familyId?: string;
  userRole?: string;
}

/**
 * Verifies the JWT access token from Authorization header.
 * Attaches userId and familyId to the request.
 */
export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError('Token de acceso requerido', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw createError('Configuración de servidor inválida', 500, 'SERVER_ERROR');

    const payload = jwt.verify(token, secret) as {
      userId: string;
      familyId: string;
      role: string;
    };

    // Quick existence check — could be cached in Redis for production
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, familyId: true, role: true },
    });

    if (!user) {
      throw createError('Usuario no encontrado', 401, 'USER_NOT_FOUND');
    }

    if (user.role === 'banned') {
      throw createError('Esta cuenta ha sido suspendida. Contactá al administrador.', 403, 'ACCOUNT_BANNED');
    }

    req.userId = user.id;
    req.familyId = user.familyId;
    req.userRole = user.role;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(createError('Token inválido o expirado', 401, 'INVALID_TOKEN'));
    } else {
      next(err);
    }
  }
}

/** Require owner role */
export function requireOwner(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.userRole !== 'owner') {
    next(createError('Solo el dueño de la cuenta puede realizar esta acción', 403, 'FORBIDDEN'));
  } else {
    next();
  }
}
