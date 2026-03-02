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

// Multer: memory storage for PDF
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) return cb(null, true);
    cb(new Error('Solo se aceptan archivos PDF'));
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

// ── POST /api/import/pdf-preview — parse PDF bank/card statement with AI ──────
importRouter.post('/pdf-preview', pdfUpload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No se recibió archivo' }); return; }

    // Extract text from PDF
    const { default: pdfParse } = await import('pdf-parse') as { default: (buf: Buffer) => Promise<{ text: string }> };
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    if (!text || text.trim().length < 50) {
      throw createError('No se pudo extraer texto del PDF. El archivo puede ser una imagen escaneada.', 400, 'PDF_NO_TEXT');
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw createError('Servicio de IA no configurado', 500, 'NO_AI');
    }

    // Use Claude to parse the statement
    const { default: Anthropic } = await import('@anthropic-ai/sdk') as any;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const aiResponse = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Analiza este extracto de tarjeta de crédito/débito uruguaya y extrae TODAS las transacciones de compras.

Para cada transacción devuelve un JSON array con objetos que tengan estos campos:
- "date": string ISO YYYY-MM-DD (usa el día y mes de la transacción, el año está en el encabezado del período)
- "description": string (nombre del comercio, limpio y capitalizado)
- "amount": número entero en centavos UYU (monto × 100, sin decimales). Para montos en dólares, indica currency=USD y convierte a centavos de USD.
- "currency": "UYU" o "USD"
- "type": "expense" para compras, "income" solo si es un pago/depósito/ajuste positivo
- "installmentCurrent": número o null (la cuota actual, ej: si dice "3/ 4" = 3)
- "installmentTotal": número o null (el total de cuotas, ej: si dice "3/ 4" = 4)
- "institution": "oca" si es OCA, "brou" si es BROU, "itau" si es Itaú, "santander" si es Santander, o "credit_card" si no se identifica

Reglas IMPORTANTES:
- Ignorar líneas de encabezado, resumen, totales, saldo, límite
- Ignorar comisiones (Comis. utilizac. Tj en ext.)
- Ignorar sub-líneas de "US Dollar X.XX" o "Uruguayan Peso X.XX" (son aclaratorias, no transacciones separadas)
- Para Uber/apps: si hay una sub-línea "Uruguayan Peso XXX,XX", usar ESE monto en UYU
- Para Netflix/Spotify/servicios en USD: importar como USD
- Los montos UYU usan punto como separador de miles y coma como decimal: "1.234,56" = 1234.56 UYU = 123456 centavos
- Ignorar montos negativos (reducciones IVA, ajustes) 
- El formato de fecha de cada línea es DD/MM dentro del período del extracto

Extracto:
${text.slice(0, 9000)}

Responde SOLO con el JSON array, sin texto adicional.`,
      }],
    });

    const aiContent = aiResponse.content[0];
    if (aiContent.type !== 'text') throw createError('Error al analizar el PDF', 500, 'AI_ERROR');

    // Parse AI response
    let transactions: Array<{
      date: string;
      description: string;
      amount: number;
      currency: string;
      type: string;
      installmentCurrent: number | null;
      installmentTotal: number | null;
      institution: string;
    }>;

    try {
      const jsonMatch = aiContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON found');
      transactions = JSON.parse(jsonMatch[0]);
    } catch {
      throw createError('No se pudo interpretar la respuesta de IA. Intente nuevamente.', 500, 'PARSE_ERROR');
    }

    // Filter valid rows
    const rows = transactions
      .filter((t) => t.amount > 0 && t.date && t.description && t.type !== 'income')
      .map((t) => ({
        date: t.date,
        description: t.description.slice(0, 255),
        amount: Math.round(t.amount),
        currency: t.currency === 'USD' ? 'USD' : 'UYU',
        type: (t.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
        installmentCurrent: t.installmentCurrent ?? null,
        installmentTotal: t.installmentTotal ?? null,
        institution: t.institution || 'credit_card',
        keep: true,
      }));

    const institution = rows[0]?.institution || 'credit_card';

    res.json({ success: true, data: { rows, totalRows: rows.length, institution } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/import/pdf-confirm — import PDF-parsed rows ────────────────────
importRouter.post('/pdf-confirm', async (req: AuthRequest, res, next) => {
  try {
    const { rows, defaultCategoryId } = req.body as {
      rows: Array<{
        date: string;
        description: string;
        amount: number;
        type: 'income' | 'expense';
        categoryId?: string;
        currency?: string;
        installmentCurrent?: number | null;
        installmentTotal?: number | null;
        institution?: string;
      }>;
      defaultCategoryId: string;
    };

    if (!rows?.length) throw createError('No hay filas para importar', 400, 'NO_ROWS');
    if (rows.length > 500) throw createError('Máximo 500 filas por importación de PDF', 400, 'TOO_MANY_ROWS');
    if (!defaultCategoryId) throw createError('Categoría por defecto requerida', 400, 'NO_CATEGORY');

    const rate = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: 'USD', toCurrency: 'UYU' },
      orderBy: { date: 'desc' },
    });
    const usdRate = rate?.rate ?? 3900;

    let imported = 0;
    let skipped = 0;

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
            importSource: 'pdf',
            institutionId: r.institution ?? null,
            paymentMethod: 'credit',
            isOcaInstallment: (r.installmentTotal ?? 0) > 1,
            ocaCurrentInstallment: r.installmentCurrent ?? null,
            ocaTotalInstallments: r.installmentTotal ?? null,
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
