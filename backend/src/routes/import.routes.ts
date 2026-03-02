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

// ── OCA/UY card statement regex parser (no AI needed) ────────────────────────
interface ParsedTx {
  date: string;
  description: string;
  amount: number;      // centavos
  currency: 'UYU' | 'USD';
  type: 'income' | 'expense';
  installmentCurrent: number | null;
  installmentTotal: number | null;
  institution: string;
  keep: boolean;
  categoryHint: string | null;  // nameEs of matched category
  categoryId: string | null;    // resolved after DB lookup
}

// Map merchant keywords → category nameEs
const MERCHANT_CATEGORY_HINTS: Array<{ pattern: RegExp; nameEs: string }> = [
  { pattern: /disco\b|devoto|tienda\s*inglesa|g[eé]ant|tata\b|multiahorro|fresh\s*market|carestino|super\s*mercado/i, nameEs: 'Comida y Restaurantes' },
  { pattern: /pedidosya|rappi|pizza\s*hut|mcdonald|burger|subway|kfc/i, nameEs: 'Comida y Restaurantes' },
  { pattern: /farmashop|farmacity/i, nameEs: 'Ropa y Personal' },
  { pattern: /\buber\b|cabify/i, nameEs: 'Transporte' },
  { pattern: /ancap|shell|petrobr[aá]s|axion\b/i, nameEs: 'Transporte' },
  { pattern: /netflix|spotify|youtube\s*premium|disney[+\s]|hbo\b|prime\s*video|apple\s*tv|paramount|deezer|twitch/i, nameEs: 'Entretenimiento' },
  { pattern: /redtickets|tickantel|cine\b|cinema|teatro\b/i, nameEs: 'Entretenimiento' },
  { pattern: /veterinaria/i, nameEs: 'Mascotas' },
  { pattern: /zara\b|h\s*[&y]\s*m\b|carter[\s']|lojas\s*renner|renner\b|metraje|divino\b|bas\s+basic|parisien|mango\b|bershka/i, nameEs: 'Ropa y Personal' },
  { pattern: /antel|ost\b|ute\b|internet|vodafone|claro\b|movistar/i, nameEs: 'Hogar y Vivienda' },
];

function guessMerchantCategory(description: string): string | null {
  for (const { pattern, nameEs } of MERCHANT_CATEGORY_HINTS) {
    if (pattern.test(description)) return nameEs;
  }
  return null;
}

function detectInstitution(text: string): string {
  const upper = text.slice(0, 500).toUpperCase();
  if (upper.includes('OCA')) return 'oca';
  if (upper.includes('BROU') || upper.includes('BANCO DE LA REPÚBLICA')) return 'brou';
  if (upper.includes('ITAÚ') || upper.includes('ITAU')) return 'itau';
  if (upper.includes('SANTANDER')) return 'santander';
  if (upper.includes('SCOTIABANK')) return 'scotiabank';
  if (upper.includes('BBVA')) return 'bbva';
  return 'credit_card';
}

function parseMonto(raw: string): number {
  // UY format: 1.234,56 -> 123456 centavos
  const clean = raw.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : Math.round(Math.abs(val) * 100);
}

function detectYearMonth(text: string): { year: number; defaultMonth: number } {
  const MONTHS: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  // Match "Diciembre/2024" or "Diciembre 2024"
  const m = text.slice(0, 1000).match(/([A-Za-záéíóúÁÉÍÓÚü]+)[\/\s]+(\d{4})/i);
  if (m) {
    const monthNum = MONTHS[m[1].toLowerCase()];
    const year = parseInt(m[2]);
    if (monthNum && !isNaN(year)) return { year, defaultMonth: monthNum };
  }
  const now = new Date();
  return { year: now.getFullYear(), defaultMonth: now.getMonth() + 1 };
}

function parseOCAStatement(text: string): ParsedTx[] {
  const institution = detectInstitution(text);
  const { year, defaultMonth } = detectYearMonth(text);

  const lines = text.split('\n');
  const results: ParsedTx[] = [];

  // Main transaction line pattern:
  // leading spaces + DD/[space]M + code (2 digits) + description + optional installments + amount
  // Examples:
  //      5/11  11  VETERINARIA                                                        490,00
  //      6/ 9  11  METRAJE                                   3/ 4                     330,00
  //     14/11  11  NETFLIX.COM                                           17,99
  const txRegex = /^\s{2,}(\d{1,2})\s*\/\s*(\d{1,2})\s+\d{1,3}\s{1,4}(.+?)\s{2,}(?:(\d{1,2})\s*\/\s*(\d{1,2})\s+)?([\d.,]+)\s*$/;

  // Skip noise descriptions (tested against trimmed description, not raw line)
  // Note: /^\s{0,3}\S/ was removed — it matched *every* trimmed description
  const SKIP_PATTERNS = [
    /reducción/i, /comis\./i, /cuota.*participación/i,
    /US Dollar/i, /Uruguayan Peso/i,
  ];

  const USD_LINE = /US\s*Dollar\s+([\d.,]+)/i;
  const UYU_LINE = /Uruguayan\s*Peso\s+([\d.,]+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = txRegex.exec(line);
    if (!match) continue;

    const [, dayStr, monthStr, rawDesc, instCurStr, instTotStr, rawAmount] = match;

    const day = parseInt(dayStr);
    let month = parseInt(monthStr);
    // OCA shows transaction month, which may differ from statement month
    if (month < 1 || month > 12) month = defaultMonth;
    // Adjust year if month > defaultMonth (previous year's transactions in Jan statement etc.)
    let txYear = year;
    if (month > defaultMonth) txYear = year - 1;

    const dateStr = `${txYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const description = rawDesc.trim().replace(/\s+/g, ' ');

    // Skip noise lines
    if (SKIP_PATTERNS.some((p) => p.test(description))) continue;
    if (description.length < 2) continue;

    const installmentCurrent = instCurStr ? parseInt(instCurStr) : null;
    const installmentTotal = instTotStr ? parseInt(instTotStr) : null;

    let amount = parseMonto(rawAmount);
    let currency: 'UYU' | 'USD' = 'UYU';

    // Look ahead for sub-line (USD or Peso clarification)
    const next1 = lines[i + 1] ?? '';
    const next2 = lines[i + 2] ?? '';

    const usdMatch = USD_LINE.exec(next1) || USD_LINE.exec(next2);
    const uyuMatch = UYU_LINE.exec(next1) || UYU_LINE.exec(next2);

    if (uyuMatch) {
      // App charged in USD but UYU sub-line shows the actual peso amount (e.g. Uber)
      amount = parseMonto(uyuMatch[1]);
      currency = 'UYU';
    } else if (usdMatch) {
      // The main line amount was already USD
      amount = parseMonto(usdMatch[1]);
      currency = 'USD';
    }

    if (amount <= 0) continue;

    results.push({
      date: dateStr,
      description,
      amount,
      currency,
      type: 'expense',
      installmentCurrent,
      installmentTotal,
      institution,
      keep: true,
      categoryHint: guessMerchantCategory(description),
      categoryId: null,
    });
  }

  return results;
}

/** Extract the statement total from the OCA PDF header area */
function extractStatementTotal(text: string): number | null {
  // OCA header line 2 pattern: "7.467 M  200.000,00  87.111,94  U$S 113,41  $ 118.024,0"
  // We want the last large UYU amount (total del resumen in pesos)
  const headerLine = text.slice(0, 2000);
  // Match pattern: $ NUMBER,NUMBER at end of header (the total)
  const match = /\$\s*([\d.]+,[\d]{1,2})/.exec(headerLine.replace(/\n/g, ' '));
  if (match) {
    const val = parseMonto(match[1]);
    if (val > 100000) return val; // avoid small amounts (minimum payment)
  }
  return null;
}

// ── POST /api/import/pdf-preview — parse PDF bank/card statement ──────────────
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

    // Try regex parser first (fast, no AI cost, works for OCA and similar formats)
    const regexRows = parseOCAStatement(text);
    const statementTotal = extractStatementTotal(text);

    // Resolve categoryHint → categoryId using the user's categories in DB
    const userCategories = await prisma.category.findMany({
      where: { familyId: req.familyId! },
      select: { id: true, nameEs: true },
    });
    const resolvedRows = regexRows.map((row) => ({
      ...row,
      categoryId: row.categoryHint
        ? (userCategories.find((c: { id: string; nameEs: string }) => c.nameEs === row.categoryHint)?.id ?? null)
        : null,
    }));

    // If regex found enough transactions, use them; otherwise try AI
    if (resolvedRows.length >= 3 || !process.env.ANTHROPIC_API_KEY) {
      const institution = resolvedRows[0]?.institution || detectInstitution(text);
      res.json({ success: true, data: { rows: resolvedRows, totalRows: resolvedRows.length, institution, parsedBy: 'regex', statementTotal } });
      return;
    }

    // ── AI fallback for unknown formats ──────────────────────────────────────
    const { default: Anthropic } = await import('@anthropic-ai/sdk') as any;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const aiResponse = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Analiza este extracto de tarjeta de crédito/débito uruguaya y extrae TODAS las transacciones de compras.

Para cada transacción devuelve un JSON array con objetos:
- "date": string ISO YYYY-MM-DD
- "description": string (nombre del comercio, capitalizado)
- "amount": entero en centavos (monto × 100). Para USD indica currency=USD y centavos de USD.
- "currency": "UYU" o "USD"
- "type": "expense" para compras
- "installmentCurrent": número o null
- "installmentTotal": número o null
- "institution": "oca"|"brou"|"itau"|"santander"|"credit_card"

Reglas: ignorar encabezados, comisiones, sub-líneas "US Dollar" o "Uruguayan Peso" (son aclaratorias).
Para Uber: usar el monto "Uruguayan Peso XXX,XX".
Montos UYU: punto=miles, coma=decimal. "1.234,56" = 123456 centavos.

Extracto:
${text.slice(0, 9000)}

Responde SOLO con el JSON array.`,
      }],
    });

    const aiContent = aiResponse.content[0];
    if (aiContent.type !== 'text') throw createError('Error al analizar el PDF', 500, 'AI_ERROR');

    let transactions: Array<{
      date: string; description: string; amount: number; currency: string;
      type: string; installmentCurrent: number | null; installmentTotal: number | null; institution: string;
    }>;

    try {
      const jsonMatch = aiContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON');
      transactions = JSON.parse(jsonMatch[0]);
    } catch {
      throw createError('No se pudo interpretar la respuesta de IA. Intente nuevamente.', 500, 'PARSE_ERROR');
    }

    const rows: ParsedTx[] = transactions
      .filter((t) => t.amount > 0 && t.date && t.description)
      .map((t) => ({
        date: t.date,
        description: t.description.slice(0, 255),
        amount: Math.round(t.amount),
        currency: (t.currency === 'USD' ? 'USD' : 'UYU') as 'UYU' | 'USD',
        type: 'expense' as const,
        installmentCurrent: t.installmentCurrent ?? null,
        installmentTotal: t.installmentTotal ?? null,
        institution: t.institution || 'credit_card',
        keep: true,
        categoryHint: guessMerchantCategory(t.description),
        categoryId: null,
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
        categoryId?: string | null;
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

    // Generate a batch ID for the whole import — allows undoing the whole batch
    const { randomUUID } = await import('crypto');
    const importBatchId = randomUUID();

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
            importBatchId,
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
