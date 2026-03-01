import { Router } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';

export const importRouter = Router();
importRouter.use(authenticate);

// Multer: memory storage for CSV (no disk needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) return cb(null, true);
    cb(new Error('Solo se aceptan archivos CSV'));
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
  return lines.slice(1).map((line) => {
    // Handle quoted fields
    const values: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,\-]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : Math.round(Math.abs(val) * 100);
}

function parseDate(raw: string): Date | null {
  // Try common formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
  const stripped = raw.trim();
  let d: Date;

  if (/^\d{4}-\d{2}-\d{2}/.test(stripped)) {
    d = new Date(stripped);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(stripped)) {
    // Could be DD/MM or MM/DD — try DD/MM/YYYY (typical in UY)
    const [dd, mm, yyyy] = stripped.split('/');
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else {
    d = new Date(stripped);
  }

  return isNaN(d.getTime()) ? null : d;
}

// ── POST /api/import/preview — parse CSV and return rows for review ────────────
importRouter.post('/preview', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No se recibió archivo' }); return; }

    const text = req.file.buffer.toString('utf-8');
    const rows = parseCSV(text);

    if (!rows.length) throw createError('El archivo CSV está vacío o el formato es inválido', 400, 'EMPTY_CSV');
    if (rows.length > 1000) throw createError('Máximo 1000 filas por importación', 400, 'TOO_MANY_ROWS');

    // Detect columns
    const sample = rows[0];
    const cols = Object.keys(sample);

    // Auto-detect common column names
    const detect = (candidates: string[]) => candidates.find((c) => cols.includes(c)) ?? null;
    const mapping = {
      date:        detect(['date', 'fecha', 'transaction_date', 'fecha_transaccion']),
      description: detect(['description', 'descripcion', 'descripción', 'concepto', 'detail', 'detalle']),
      amount:      detect(['amount', 'monto', 'importe', 'value', 'valor']),
      type:        detect(['type', 'tipo', 'transaction_type']),
      category:    detect(['category', 'categoria', 'categoría']),
      currency:    detect(['currency', 'moneda']),
    };

    // Parse a preview of first 20 rows
    const preview = rows.slice(0, 20).map((row) => ({
      date:        mapping.date        ? parseDate(row[mapping.date!])             : null,
      description: mapping.description ? row[mapping.description!]                 : '',
      amount:      mapping.amount      ? parseAmount(row[mapping.amount!])         : null,
      type:        mapping.type        ? (row[mapping.type!]?.toLowerCase().includes('ingreso') || row[mapping.type!]?.toLowerCase().includes('income') ? 'income' : 'expense') : 'expense',
      category:    mapping.category    ? row[mapping.category!]                    : '',
      currency:    mapping.currency    ? row[mapping.currency!]?.toUpperCase()     : 'UYU',
      _raw: row,
    }));

    res.json({ success: true, data: { rows: preview, totalRows: rows.length, mapping, availableColumns: cols } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/import/confirm — import confirmed rows ──────────────────────────
const importSchema = {
  defaultCategoryId: '',
  rows: [] as Array<{
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    categoryId?: string;
    currency?: string;
  }>,
};
void importSchema;

importRouter.post('/confirm', async (req: AuthRequest, res, next) => {
  try {
    const { rows, defaultCategoryId } = req.body as {
      rows: Array<{
        date: string;
        description: string;
        amount: number;
        type: 'income' | 'expense';
        categoryId?: string;
        currency?: string;
      }>;
      defaultCategoryId: string;
    };

    if (!rows?.length) throw createError('No hay filas para importar', 400, 'NO_ROWS');
    if (rows.length > 1000) throw createError('Máximo 1000 filas por importación', 400, 'TOO_MANY_ROWS');
    if (!defaultCategoryId) throw createError('Categoría por defecto requerida', 400, 'NO_CATEGORY');

    // Get exchange rate
    const rate = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: 'USD', toCurrency: 'UYU' },
      orderBy: { date: 'desc' },
    });
    const usdRate = rate?.rate ?? 3900;

    let imported = 0;
    let skipped = 0;

    // Batch create in chunks of 50
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const toCreate = chunk.filter((r) => r.amount > 0 && r.date && r.description);

      await prisma.transaction.createMany({
        data: toCreate.map((r) => {
          const currency = (r.currency === 'USD' ? 'USD' : 'UYU') as 'UYU' | 'USD';
          const amountUYU = currency === 'USD' ? Math.round(r.amount * usdRate) : r.amount;
          return {
            amount: r.amount,
            currency,
            amountUYU,
            exchangeRateUsed: currency === 'USD' ? usdRate : null,
            description: r.description.slice(0, 255),
            date: new Date(r.date),
            type: r.type,
            categoryId: r.categoryId ?? defaultCategoryId,
            userId: req.userId!,
            familyId: req.familyId!,
            tags: [],
            importSource: 'csv',
          };
        }),
        skipDuplicates: true,
      });

      imported += toCreate.length;
      skipped += chunk.length - toCreate.length;
    }

    res.json({ success: true, data: { imported, skipped } });
  } catch (err) {
    next(err);
  }
});
