import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Centralized error handler middleware.
 * Returns consistent JSON error responses in Spanish.
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[Error] ${err.message}`, isDev ? err.stack : '');

  res.status(statusCode).json({
    success: false,
    error: err.message ?? 'Error interno del servidor',
    message: err.message ?? 'Error interno del servidor',
    code: err.code,
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Factory to create consistent AppErrors.
 */
export function createError(message: string, statusCode: number, code?: string): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
