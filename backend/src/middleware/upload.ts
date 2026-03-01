import multer from 'multer';
import { createError } from './errorHandler';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Multer configuration: stores files in memory for Cloudinary upload.
 * Enforces file type whitelist and max size.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, callback) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        createError(
          'Tipo de archivo no permitido. Solo se admiten JPG, PNG, WEBP y PDF.',
          400,
          'INVALID_FILE_TYPE'
        )
      );
    }
  },
});
