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
    if (rows.some((r) => !r.categoryId) && !defaultCategoryId) throw createError('Categoría por defecto requerida', 400, 'NO_CATEGORY');

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
  subcategoryId?: string | null; // resolved from learned history
  possibleDuplicate?: boolean;  // true when similar tx already exists in DB
  cardCode: string | null;      // card code from statement (e.g. "11", "29", "45")
}

// Map merchant keywords → category nameEs
const MERCHANT_CATEGORY_HINTS: Array<{ pattern: RegExp; nameEs: string }> = [
  // ── Comida y Restaurantes ──────────────────────────────────────────────────
  { pattern: /disco\b|devoto|tienda\s*inglesa|g[eé]ant|tata\b|multiahorro|fresh\s*market|macromercado|carestino|super\s*mercado|natal\b|acodike/i, nameEs: 'Comida y Restaurantes' },
  { pattern: /pedidosya|rappi|pizza\s*hut|mcdonald|mc\s*donalds|burger\b|subway\b|kfc\b|wendy|popeyes|mercado\s*del\s*este/i, nameEs: 'Comida y Restaurantes' },

  // ── Cuidado Personal (belleza y estética — SIN farmacia) ──────────────────
  { pattern: /peluquer[ií]a|barber[ií]a|spa\b|manicur|pedicur|est[eé]tica|guapa\b/i, nameEs: 'Cuidado Personal' },

  // ── Salud (farmacia va AQUÍ, no en Cuidado Personal) ─────────────────────
  { pattern: /farmashop|farmacity|farma\b/i, nameEs: 'Salud' },
  { pattern: /[oó]ptica\b|optica\b/i, nameEs: 'Salud' },
  { pattern: /fisiocare|fisio\b|kinesi/i, nameEs: 'Salud' },
  { pattern: /asociaci[oó]n\s*espa[nñ]ola|espa[nñ]ola\s*m[oó]vil/i, nameEs: 'Salud' },

  // ── Transporte ────────────────────────────────────────────────────────────
  { pattern: /\buber\s*\*?\s*trip\b|dlo\s*\*uber|merpago\s*\*uber|cabify/i, nameEs: 'Transporte' },
  { pattern: /ancap|shell|petrobr[aá]s|axion\b|servicentro/i, nameEs: 'Transporte' },
  { pattern: /\bstm\b|telepeaje|autopass|\bacu\b/i, nameEs: 'Transporte' },
  { pattern: /\bavis\b|\bhertz\b|\beuropcar\b/i, nameEs: 'Transporte' },

  // ── Entretenimiento ───────────────────────────────────────────────────────
  { pattern: /netflix|spotify|youtube\s*premium|disney[+\s]|hbo\b|prime\s*video|apple\s*tv|paramount|deezer|twitch|vmusic/i, nameEs: 'Entretenimiento' },
  { pattern: /redtickets|tickantel|cine\b|cinema|teatro\b|cinemark/i, nameEs: 'Entretenimiento' },

  // ── Trabajo y Tecnología ──────────────────────────────────────────────────
  { pattern: /clickup|github|notion\b|slack\b|\bzoom\b|figma\b|adobe\b|heroku|vercel|netlify|dropbox|aws\b|digital\s*ocean/i, nameEs: 'Trabajo y Tecnología' },

  // ── Educación ─────────────────────────────────────────────────────────────
  { pattern: /bookshop|bestseler|libros\b/i, nameEs: 'Educación' },

  // ── Ropa y Accesorios ─────────────────────────────────────────────────────
  { pattern: /zara\b|h\s*[&y]\s*m\b|carter[\s']|renner\b|metraje|divino\b|bas\s+basic|parisien|mango\b|bershka|decathlon|gap\b|gap\s+m\b|lemon\b|kinko\b|chic\b/i, nameEs: 'Ropa y Accesorios' },
  // STADIUM vende ropa y artículos deportivos → Ropa y Accesorios
  { pattern: /\bstadium\b/i, nameEs: 'Ropa y Accesorios' },

  // ── Mascotas ──────────────────────────────────────────────────────────────
  { pattern: /veterinaria/i, nameEs: 'Mascotas' },

  // ── Hogar y Vivienda ──────────────────────────────────────────────────────
  { pattern: /\bantel\b|ost\b|\bute\b|vodafone|claro\b|movistar|flow\b|telmex/i, nameEs: 'Hogar y Vivienda' },
  { pattern: /handy\b|sofiaquiler/i, nameEs: 'Hogar y Vivienda' },

  // ── Seguros (METLIFE, MAPFRE → NO van a Finanzas, van aquí) ──────────────
  { pattern: /metlife|mapfre|sancor|bse\b|surre[ao]\b|asistencia\s*365/i, nameEs: 'Seguros' },

  // ── Regalos y Donaciones ──────────────────────────────────────────────────
  { pattern: /bigbox/i, nameEs: 'Regalos y Donaciones' },

  // ── Finanzas (cargos e intereses bancarios/tarjeta) ───────────────────────
  { pattern: /recargo|inter[eé]s|cargo\s+financ|cargo\s+admin|comisi[oó]n|iva\s+s\//i, nameEs: 'Finanzas' },
];

/** Normalize description for merchant learning: lowercase, trim, strip trailing random codes */
function normalizeDesc(desc: string): string {
  return desc.toLowerCase().trim()
    .replace(/\s+[A-Z0-9]{6,}\s*$/i, '')  // strip trailing codes like "P313C6CBB9"
    .replace(/\s+/g, ' ');
}

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
  // Strip leading * (OCA payment lines) and normalize separators
  const clean = raw.replace(/^\*/, '').replace(/\./g, '').replace(/,/g, '.');
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
  // Match "Febrero/2026" or "Diciembre 2024" — search wider window and require real month name
  const m = text.slice(0, 3000).match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)[\/\s]+(\d{4})\b/i);
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

  // ── Pre-process: OCA PDF extraction wraps amounts across lines in two ways ───
  // (a) Large amount (>=1000): leading digit(s) at end of description line,
  //     continuation ".DDD,DD" on the NEXT line.
  //     e.g. "   8/ 2  29  GEANT    4\n.547,79..." → "...GEANT    4.547,79..."
  // (b) Any amount: next line contains ONLY the amount (description line ends
  //     with spaces or an installment fraction like "2/ 6").
  //     e.g. "   17/ 1  45  MCDONALDS    \n 468,00" → "...MCDONALDS    468,00"
  //     e.g. "   19/12  45  MERPAGO*ONLY  2/ 6\n 452,83" → "...2/ 6  452,83"
  const rawLines = text.split('\n');
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i];
    const nxt = rawLines[i + 1] ?? '';

    // Case (a): line ends with 1-3 digits, next line starts with .DDD,DD
    // Skip joining if the line is a summary/total line to avoid false joins
    if (/\d{1,3}\s*$/.test(cur) && /^\s*\.\d{3},\d{1,2}/.test(nxt) && !/total|saldo|pago\b/i.test(cur)) {
      lines.push(cur.trimEnd() + nxt.trim());
      i++;
      continue;
    }

    lines.push(cur);
  }

  const results: ParsedTx[] = [];

  // Main transaction line pattern (amount on same line):
  // leading spaces + DD/MM + card-code + description + optional installments + amount
  // Examples (after pre-processing):
  //      5/11  11  VETERINARIA                                          490,00
  //      6/ 9  11  METRAJE                             3/ 4             330,00
  //     14/11  11  NETFLIX.COM                                           17,99
  const txRegex = /^\s{2,}(\d{1,2})\s*\/\s*(\d{1,2})\s+(\d{1,3})\s{1,4}(.+?)\s{2,}(?:(\d{1,2})\s*\/\s*(\d{1,2})\s+)?(\*?[\d.,]+)\s*$/;

  // Transaction header line where amount is on the NEXT line (case b above).
  // These end with description or installment fraction, no trailing amount.
  const txHeaderOnlyRegex = /^\s{2,}(\d{1,2})\s*\/\s*(\d{1,2})\s+(\d{1,3})\s{1,4}(.+?)(?:\s{2,}(\d{1,2})\s*\/\s*(\d{1,2}))?\s*$/;

  // "Amount-only" next line: optional whitespace, then just a number (possibly negative or with * prefix)
  const AMOUNT_ONLY_LINE = /^\s*(-?\*?[\d.,]+)\s*$/;

  // Skip noise descriptions
  const SKIP_PATTERNS = [
    /reducci[oó]n/i, /comisi?[oó]?n|comis\./i, /cuota.*participaci[oó]n/i,
    /US Dollar/i, /Uruguayan Peso/i, /su\s+pago/i,
  ];

  const USD_LINE = /US\s*Dollar\s+([\d.,]+)/i;
  const UYU_LINE = /Uruguayan\s*Peso\s+([\d.,]+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let dayStr!: string, monthStr!: string, rawDesc!: string;
    let cardCodeStr: string | undefined;
    let instCurStr: string | undefined, instTotStr: string | undefined;
    let rawAmount!: string;
    let amountFromNextLine = false;

    const match = txRegex.exec(line);
    if (match) {
      [, dayStr, monthStr, cardCodeStr, rawDesc, instCurStr, instTotStr, rawAmount] = match;
    } else {
      // Try header-only match: amount expected on next line (case b)
      const hMatch = txHeaderOnlyRegex.exec(line);
      if (!hMatch) continue;

      const nxt = lines[i + 1] ?? '';
      const amtMatch = AMOUNT_ONLY_LINE.exec(nxt);
      // Skip if no amount line found, or amount is negative (discount / payment)
      if (!amtMatch || amtMatch[1].startsWith('-')) continue;

      [, dayStr, monthStr, cardCodeStr, rawDesc, instCurStr, instTotStr] = hMatch;
      rawAmount = amtMatch[1];
      amountFromNextLine = true;
    }

    const day = parseInt(dayStr);
    // All transactions on the statement are BILLED in the statement month,
    // regardless of the original purchase date.  Using the statement month:
    // 1. KPIs / monthly view show the full billed amount (matches the PDF total).
    // 2. Installment projections work correctly (installment N in month M →
    //    installment N+1 in month M+1).
    // We keep the original day (clamped to valid range for the statement month).
    const maxDay = new Date(year, defaultMonth, 0).getDate();
    const clampedDay = Math.min(Math.max(day, 1), maxDay);

    const dateStr = `${year}-${String(defaultMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    const description = rawDesc.trim().replace(/\s+/g, ' ');

    if (SKIP_PATTERNS.some((p) => p.test(description))) {
      if (amountFromNextLine) i++; // consume the amount line
      continue;
    }
    if (description.length < 2) {
      if (amountFromNextLine) i++;
      continue;
    }

    const installmentCurrent = instCurStr ? parseInt(instCurStr) : null;
    const installmentTotal = instTotStr ? parseInt(instTotStr) : null;

    let amount = parseMonto(rawAmount);
    let currency: 'UYU' | 'USD' = 'UYU';

    // Look ahead for USD/UYU sub-line clarification (e.g. UBER, CLICKUP)
    // IMPORTANT: only check next1 (the immediately following line).
    // Checking next2 caused a bug where the currency marker of the NEXT
    // transaction leaked into the CURRENT one (e.g. VETERINARIA getting
    // NETFLIX's "US Dollar" line).
    const lookBase = amountFromNextLine ? i + 2 : i + 1;
    const next1 = lines[lookBase] ?? '';

    const usdMatch = USD_LINE.exec(next1);
    const uyuMatch = UYU_LINE.exec(next1);

    if (usdMatch) {
      amount = parseMonto(usdMatch[1]);
      currency = 'USD';
    } else if (uyuMatch) {
      amount = parseMonto(uyuMatch[1]);
      currency = 'UYU';
    }

    if (amount <= 0) {
      if (amountFromNextLine) i++;
      continue;
    }

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
      cardCode: cardCodeStr ?? null,
    });

    // Advance past the amount-only continuation line
    if (amountFromNextLine) i++;
  }

  // ── Secondary pass: recargos, intereses y cargos sin fecha ──────────────────
  // These appear as floating lines in OCA statements without the DD/MM date prefix.
  // After pre-processing (case a), large-amount lines are already joined.
  const chargeRegex = /^\s{2,}((?:RECARGO|INTER[EÉ]S|CARGO\s+(?:FINANC|ADMIN|SERVIC)|COMISI[OÓ]N|IVA\s+S\/)[\w\s.,()/-]{0,60}?)\s{3,}([\d.,]+)\s*$/i;
  const statementDateStr = `${year}-${String(defaultMonth).padStart(2, '0')}-01`;
  for (const line of lines) {
    const mc = chargeRegex.exec(line);
    if (!mc) continue;
    const chargeDesc = mc[1].trim().replace(/\s+/g, ' ');
    const chargeAmount = parseMonto(mc[2]);
    if (chargeAmount <= 0 || chargeAmount > 50_000_000) continue;
    results.push({
      date: statementDateStr,
      description: chargeDesc,
      amount: chargeAmount,
      currency: 'UYU',
      type: 'expense',
      installmentCurrent: null,
      installmentTotal: null,
      institution,
      keep: true,
      categoryHint: 'Finanzas',
      categoryId: null,
      cardCode: null,
    });
  }

  return results;
}

/** Extract the statement total from the OCA PDF header area */
function extractStatementTotal(text: string): number | null {
  // Pre-join wrapped lines (same logic as parseOCAStatement)
  // OCA wraps large amounts: "142" on one line, ".105,20" on next
  const rawLines = text.split('\n');
  const joined: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i];
    const nxt = rawLines[i + 1] ?? '';
    if (/\d{1,3}\s*$/.test(cur) && /^\s*\.\d{3},\d{1,2}/.test(nxt)) {
      joined.push(cur.trimEnd() + nxt.trim());
      i++;
    } else {
      joined.push(cur);
    }
  }
  const processed = joined.join('\n');

  // 1. Primary: search for "TOTAL COMPRAS DEL MES" — the monthly purchases total (UYU part)
  //    Format: "TOTAL COMPRAS DEL MES   154,42   142.105,20"
  //    (first number = USD, second = UYU total)
  const totalComprasMatch = /TOTAL\s+COMPRAS\s+DEL\s+MES\s+[\d.,]+\s+([\d.,]+)/i.exec(processed);
  if (totalComprasMatch) {
    const val = parseMonto(totalComprasMatch[1]);
    if (val > 10000) return val; // must be at least $100
  }

  // 2. Fallback: $ NNN.NNN,NN pattern in first 3000 chars (account balance from header)
  //    Also handles split: "$ 1\n33.166,0" → after join → "$ 133.166,0"
  const headerText = processed.slice(0, 3000).replace(/\n/g, ' ')
    // Rejoin any remaining splits: "$ 1 33.166,0" → "$ 133.166,0"
    .replace(/(\$\s*\d{1,3})\s+(\d)/g, '$1$2');
  const headerMatch = /\$\s*([\d.]+,[\d]{1,2})/.exec(headerText);
  if (headerMatch) {
    const val = parseMonto(headerMatch[1]);
    if (val > 10000 && val < 100_000_000) return val; // sanity: $100 to $1M
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

    // Resolve categories: 1) learned from past transactions, 2) keyword hint, 3) null
    const [userCategories, learnedTxs] = await Promise.all([
      prisma.category.findMany({ where: { familyId: req.familyId! }, select: { id: true, nameEs: true } }),
      prisma.transaction.findMany({
        where: { familyId: req.familyId! },
        select: { description: true, categoryId: true, subcategoryId: true },
        orderBy: { date: 'asc' }, // oldest first → newest overwrites
        take: 2000,
      }),
    ]);

    // Build learned maps: normalized description → categoryId / subcategoryId
    const learnedMap = new Map<string, string>();
    const learnedSubcategoryMap = new Map<string, string | null>();
    for (const tx of learnedTxs) {
      const key = normalizeDesc(tx.description);
      if (key.length >= 3) {
        learnedMap.set(key, tx.categoryId);
        learnedSubcategoryMap.set(key, tx.subcategoryId ?? null);
      }
    }

    const resolvedRows = regexRows.map((row) => {
      // 1. Learning takes priority (user already classified this merchant before)
      const descKey = normalizeDesc(row.description);
      const learnedId = learnedMap.get(descKey);
      if (learnedId) return { ...row, categoryId: learnedId, subcategoryId: learnedSubcategoryMap.get(descKey) ?? null };
      // 2. Static keyword hint
      const hintId = row.categoryHint
        ? (userCategories.find((c) => c.nameEs === row.categoryHint)?.id ?? null)
        : null;
      return { ...row, categoryId: hintId, subcategoryId: null };
    });

    // If regex found enough transactions, use them; otherwise try AI
    if (resolvedRows.length >= 3 || !process.env.ANTHROPIC_API_KEY) {
      const institution = resolvedRows[0]?.institution || detectInstitution(text);

      // ── Duplicate detection ────────────────────────────────────────────────
      // Match by normalized description + amount + date ±2 days
      // For installments: same description, same total installments, same cuota = duplicate
      let finalRows: typeof resolvedRows = resolvedRows;
      if (resolvedRows.length > 0) {
        const rowDates = resolvedRows.map((r) => new Date(r.date).getTime()).filter((t) => !isNaN(t));
        if (rowDates.length > 0) {
          const minDate = new Date(Math.min(...rowDates) - 3 * 86400000);
          const maxDate = new Date(Math.max(...rowDates) + 3 * 86400000);
          const existing = await prisma.transaction.findMany({
            where: { familyId: req.familyId!, date: { gte: minDate, lte: maxDate }, importSource: 'pdf' },
            select: { amount: true, date: true, description: true, ocaCurrentInstallment: true, ocaTotalInstallments: true },
          });
          finalRows = resolvedRows.map((row) => {
            const rowDate = new Date(row.date).getTime();
            const rowDescNorm = normalizeDesc(row.description);
            const isDupe = existing.some((ex) => {
              const diff = Math.abs(ex.date.getTime() - rowDate);
              if (diff > 2 * 86400000) return false;
              if (ex.amount !== row.amount) return false;
              // Compare normalized descriptions
              const exDescNorm = normalizeDesc(ex.description);
              if (rowDescNorm !== exDescNorm) return false;
              // For installments: must match installment number exactly
              if (row.installmentTotal && row.installmentTotal > 1) {
                return ex.ocaTotalInstallments === row.installmentTotal &&
                  ex.ocaCurrentInstallment === row.installmentCurrent;
              }
              return true;
            });
            return isDupe ? { ...row, possibleDuplicate: true } : row;
          });
        }
      }

      // ── Card aliases: look up existing aliases for the found card codes ──
      const distinctCardCodes = [...new Set(finalRows.map((r) => r.cardCode).filter(Boolean))] as string[];
      let cardAliases: Array<{ cardCode: string; aliasName: string }> = [];
      if (distinctCardCodes.length > 0) {
        const aliases = await prisma.cardAlias.findMany({
          where: { familyId: req.familyId!, institution, cardCode: { in: distinctCardCodes } },
          select: { cardCode: true, aliasName: true },
        });
        cardAliases = aliases;
      }

      res.json({ success: true, data: { rows: finalRows, totalRows: finalRows.length, institution, parsedBy: 'regex', statementTotal, cardCodes: distinctCardCodes, cardAliases } });
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
        cardCode: null,
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
    const { rows, defaultCategoryId, cardAliases } = req.body as {
      rows: Array<{
        date: string;
        description: string;
        amount: number;
        type: 'income' | 'expense';
        categoryId?: string | null;
        subcategoryId?: string | null;
        currency?: string;
        installmentCurrent?: number | null;
        installmentTotal?: number | null;
        institution?: string;
        isRecurring?: boolean;
        cardCode?: string | null;
      }>;
      defaultCategoryId: string;
      cardAliases?: Array<{ cardCode: string; aliasName: string; institution: string }>;
    };

    if (!rows?.length) throw createError('No hay filas para importar', 400, 'NO_ROWS');
    if (rows.length > 500) throw createError('Máximo 500 filas por importación de PDF', 400, 'TOO_MANY_ROWS');
    if (rows.some((r) => !r.categoryId) && !defaultCategoryId) throw createError('Categoría por defecto requerida', 400, 'NO_CATEGORY');

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
            subcategoryId: r.subcategoryId ?? null,
            userId: req.userId!,
            familyId: req.familyId!,
            tags: [],
            importSource: 'pdf',
            importBatchId,
            institutionId: r.institution ?? null,
            paymentMethod: 'credit',
            isRecurring: r.isRecurring ?? false,
            isOcaInstallment: (r.installmentTotal ?? 0) > 1,
            ocaCurrentInstallment: r.installmentCurrent ?? null,
            ocaTotalInstallments: r.installmentTotal ?? null,
            ocaCardCode: r.cardCode ?? null,
          };
        }),
        skipDuplicates: true,
      });

      imported += toCreate.length;
      skipped += chunk.length - toCreate.length;
    }

    // ── Upsert card aliases if provided ──────────────────────────────────────
    if (cardAliases && cardAliases.length > 0) {
      for (const alias of cardAliases) {
        if (!alias.cardCode || !alias.aliasName || !alias.institution) continue;
        await prisma.cardAlias.upsert({
          where: {
            familyId_institution_cardCode: {
              familyId: req.familyId!,
              institution: alias.institution,
              cardCode: alias.cardCode,
            },
          },
          create: {
            familyId: req.familyId!,
            institution: alias.institution,
            cardCode: alias.cardCode,
            aliasName: alias.aliasName,
          },
          update: { aliasName: alias.aliasName },
        });
      }
    }

    res.json({ success: true, data: { imported, skipped, batchId: importBatchId } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/import/batches — list recent import batches for this family ───────────
importRouter.get('/batches', async (req: AuthRequest, res, next) => {
  try {
    const batches = await prisma.transaction.groupBy({
      by: ['importBatchId', 'importSource'],
      where: { familyId: req.familyId!, importBatchId: { not: null } },
      _count: { id: true },
      _sum: { amountUYU: true },
      _min: { date: true },
      _max: { date: true, createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 30,
    });
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/import/installments-liberation — cuotas que se liberan en un mes ──
// Accepts ?month=MM&year=YYYY to show installments whose LAST cuota falls in that month.
// If no month/year provided, defaults to current month.
// Also accepts ?excludeRecurring=true to hide recurring expenses.
importRouter.get('/installments-liberation', async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const targetMonth = parseInt(req.query['month'] as string) || (now.getMonth() + 1); // 1-12
    const targetYear = parseInt(req.query['year'] as string) || now.getFullYear();
    const excludeRecurring = req.query['excludeRecurring'] === 'true';

    // All OCA installment transactions for this family
    const whereClause: Record<string, unknown> = {
      familyId: req.familyId!,
      isOcaInstallment: true,
      ocaTotalInstallments: { gt: 1 },
    };
    if (excludeRecurring) {
      whereClause['isRecurring'] = false;
    }

    const installments = await prisma.transaction.findMany({
      where: whereClause as any,
      select: {
        id: true, description: true, amountUYU: true, amount: true, currency: true,
        date: true, ocaCurrentInstallment: true, ocaTotalInstallments: true,
        isRecurring: true,
        category: { select: { nameEs: true, icon: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Target month boundaries (1st of targetMonth to 1st of next month)
    const targetStart = new Date(targetYear, targetMonth - 1, 1);
    const targetEnd = new Date(targetYear, targetMonth, 1); // exclusive (1st of next month)

    // Find items where the last cuota falls within the target month
    const liberation: Array<{
      id: string; description: string; amountUYU: number; currency: string;
      categoryName: string; categoryIcon: string;
      current: number; total: number; remainingMonths: number;
      freeDate: string; isRecurring: boolean;
    }> = [];

    const seen = new Set<string>(); // avoid duplicates (multiple cuotas of same purchase)

    for (const tx of installments) {
      const cur = tx.ocaCurrentInstallment ?? 1;
      const total = tx.ocaTotalInstallments ?? 1;
      if (cur < 1 || total < 1) continue;

      // Key: description + total (identifies the purchase)
      const key = `${tx.description.toLowerCase().trim()}|${total}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // The month AFTER the last installment payment = "free month"
      // freeMonth is the 1st of the month when you stop paying
      const txDate = new Date(tx.date);
      const freeMonth = new Date(txDate.getFullYear(), txDate.getMonth() + (total - cur) + 1, 1);

      // Check if freeMonth falls within target month (i.e., last cuota was the month before)
      if (freeMonth >= targetStart && freeMonth < targetEnd) {
        const lastCuotaDate = new Date(txDate.getFullYear(), txDate.getMonth() + (total - cur), txDate.getDate());
        const remaining = total - cur;
        liberation.push({
          id: tx.id,
          description: tx.description,
          amountUYU: tx.amountUYU,
          currency: tx.currency,
          categoryName: tx.category?.nameEs ?? 'Sin categoría',
          categoryIcon: tx.category?.icon ?? '💳',
          current: cur,
          total,
          remainingMonths: remaining,
          freeDate: lastCuotaDate.toISOString().split('T')[0],
          isRecurring: tx.isRecurring,
        });
      }
    }

    // Sort by freeDate ascending
    liberation.sort((a, b) => a.freeDate.localeCompare(b.freeDate));

    const totalMonthlyLiberated = liberation.reduce((s, it) => s + it.amountUYU, 0);

    res.json({ success: true, data: { liberation, totalMonthlyLiberated } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/import/installments-projection — proyección mensual de cuotas ───
importRouter.get('/installments-projection', async (req: AuthRequest, res, next) => {
  try {
    const monthsAhead = Math.min(parseInt(req.query['months'] as string ?? '6') || 6, 24);

    const installments = await prisma.transaction.findMany({
      where: {
        familyId: req.familyId!,
        isOcaInstallment: true,
        ocaTotalInstallments: { gt: 1 },
      },
      select: {
        id: true, description: true, amountUYU: true, currency: true,
        date: true, ocaCurrentInstallment: true, ocaTotalInstallments: true,
        category: { select: { nameEs: true, icon: true, color: true } },
      },
      orderBy: { date: 'desc' },
    });

    const now = new Date();
    // Start of current month
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build by-month projection map
    // Key: "YYYY-MM"
    const monthMap = new Map<string, {
      year: number; month: number;
      items: Array<{ description: string; amountUYU: number; currency: string; currentInstallment: number; totalInstallments: number; categoryIcon: string; categoryColor: string }>;
    }>();

    // Pre-fill months
    for (let m = 0; m <= monthsAhead; m++) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + m, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, { year: d.getFullYear(), month: d.getMonth() + 1, items: [] });
    }

    // Deduplicate installment purchases: keep only the most-recent (highest cur) per purchase
    const purchaseMap = new Map<string, typeof installments[number]>();
    for (const tx of installments) {
      const key = `${tx.description.toLowerCase().trim()}|${tx.ocaTotalInstallments}`;
      const existing = purchaseMap.get(key);
      const curNew = tx.ocaCurrentInstallment ?? 1;
      const curEx = existing?.ocaCurrentInstallment ?? 0;
      if (!existing || curNew > curEx) purchaseMap.set(key, tx);
    }

    for (const tx of purchaseMap.values()) {
      const cur = tx.ocaCurrentInstallment ?? 1;
      const total = tx.ocaTotalInstallments ?? 1;
      const txDate = new Date(tx.date);

      // Project each remaining installment (cur+1 to total)
      for (let installNum = cur + 1; installNum <= total; installNum++) {
        const monthsFromTx = installNum - cur; // e.g., next cuota is 1 month ahead
        const projDate = new Date(txDate.getFullYear(), txDate.getMonth() + monthsFromTx, 1);
        const projKey = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`;

        const entry = monthMap.get(projKey);
        if (entry) {
          entry.items.push({
            description: tx.description,
            amountUYU: tx.amountUYU,
            currency: tx.currency,
            currentInstallment: installNum,
            totalInstallments: total,
            categoryIcon: tx.category?.icon ?? '💳',
            categoryColor: tx.category?.color ?? '#6366f1',
          });
        }
      }
    }

    const projection = Array.from(monthMap.values()).map((m) => ({
      ...m,
      totalAmountUYU: m.items.reduce((s, it) => s + it.amountUYU, 0),
    }));

    res.json({ success: true, data: { projection } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/import/batch/:batchId — delete all transactions in a batch ───
// Also wired to the undo button in ImportCSVModal immediately after confirming
importRouter.delete('/batch/:batchId', async (req: AuthRequest, res, next) => {
  try {
    const { batchId } = req.params;
    if (!batchId) throw createError('batchId requerido', 400, 'MISSING_PARAM');
    const { count } = await prisma.transaction.deleteMany({
      where: { familyId: req.familyId!, importBatchId: batchId },
    });
    res.json({ success: true, data: { deleted: count } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/import/card-aliases — list aliases for this family ──────────────
importRouter.get('/card-aliases', async (req: AuthRequest, res, next) => {
  try {
    const aliases = await prisma.cardAlias.findMany({
      where: { familyId: req.familyId! },
      orderBy: { cardCode: 'asc' },
    });
    res.json({ success: true, data: aliases });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/import/card-aliases — create or update a card alias ────────────
importRouter.post('/card-aliases', async (req: AuthRequest, res, next) => {
  try {
    const { cardCode, aliasName, institution } = req.body as {
      cardCode: string;
      aliasName: string;
      institution: string;
    };
    if (!cardCode || !aliasName || !institution) {
      throw createError('cardCode, aliasName e institution son requeridos', 400, 'MISSING_PARAMS');
    }
    const alias = await prisma.cardAlias.upsert({
      where: {
        familyId_institution_cardCode: {
          familyId: req.familyId!,
          institution,
          cardCode,
        },
      },
      create: {
        familyId: req.familyId!,
        institution,
        cardCode,
        aliasName,
      },
      update: { aliasName },
    });
    res.json({ success: true, data: alias });
  } catch (err) {
    next(err);
  }
});
