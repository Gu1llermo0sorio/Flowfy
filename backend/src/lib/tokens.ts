import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import crypto from 'crypto';

export interface TokenPayload {
  userId: string;
  familyId: string;
  role: string;
}

/**
 * Generates a short-lived JWT access token (15 min).
 */
export function generateAccessToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

/**
 * Creates and persists a refresh token tied to a user (7 day expiry).
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

/**
 * Validates a refresh token and returns the user it belongs to.
 * Returns null if invalid or expired.
 */
export async function validateRefreshToken(token: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, familyId: true, role: true } } },
  });

  if (!record) return null;
  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: record.id } });
    return null;
  }
  return record.user;
}

/**
 * Deletes a refresh token (logout).
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken
    .delete({ where: { token } })
    .catch(() => undefined); // ignore if already deleted
}

/**
 * Deletes all refresh tokens for a user (logout all devices).
 */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
