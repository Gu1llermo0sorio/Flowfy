import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';

// ── Parsed receipt shape ────────────────────────────────────────────────────────
export interface ParsedReceiptItem {
  description: string;
  amount: number;
  categoryHint: string;  // food|transport|health|shopping|utilities|education|housing|entertainment|cleaning|hygiene|snacks|electronics|other
}

interface ParsedReceipt {
  merchant: string | null;
  isMultiItem: boolean;           // true when receipt has multi-category line items (supermarket)
  items: ParsedReceiptItem[];     // populated when isMultiItem=true, grouped by category
  // Single-transaction fields (isMultiItem=false):
  description: string | null;
  amount: number | null;
  currency: 'UYU' | 'USD' | 'EUR' | null;
  date: string | null;            // YYYY-MM-DD
  categoryHint: string | null;
  paymentMethod: string | null;
  confidence: number;             // 0-1
}

export const documentRouter = Router();
documentRouter.use(authenticate);

// ── Multer storage (local uploads/) ───────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de archivo no soportado. Use JPG, PNG o PDF.'));
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────────
async function runOCR(filePath: string): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('spa+eng');
    const { data } = await worker.recognize(filePath);
    await worker.terminate();
    return data.text;
  } catch {
    return '';
  }
}

/**
 * Parse a raw number string handling both:
 *  - UY/EU format: thousands='.', decimal=','  → "1.470" = 1470, "1.470,50" = 1470.50
 *  - US format: thousands=',', decimal='.'     → "1,470" = 1470, "1,470.50" = 1470.50
 */
function parseAmount(raw: string): number | null {
  const digits = raw.replace(/[^0-9.,]/g, '');
  if (!digits || digits.length === 0) return null;

  const lastDot   = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');

  let normalized: string;
  if (lastComma > lastDot) {
    // UY/EU: "1.470,50" → remove dots (thousands), replace comma with dot
    normalized = digits.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Check if dot is a thousands separator: exactly 3 digits after dot and no decimal follows
    const afterDot = digits.slice(lastDot + 1);
    if (afterDot.length === 3 && !afterDot.includes(',')) {
      // Dot is thousands separator: "1.470" = 1470
      normalized = digits.replace(/\./g, '');
    } else {
      // Dot is decimal: "1470.50" or "1,470.50"
      normalized = digits.replace(/,/g, '');
    }
  } else {
    normalized = digits;
  }

  const value = parseFloat(normalized);
  return isNaN(value) || value <= 0 ? null : value;
}

function extractAmounts(text: string): Array<{ raw: string; value: number }> {
  // Match patterns like 1.234,56 or 1,234.56 or 1234 or $U1.234
  const regex = /\$[Uu]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?/g;
  const results: Array<{ raw: string; value: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[0].trim();
    const value = parseAmount(raw);
    if (value !== null && value >= 1) results.push({ raw, value });
  }
  // Remove duplicates and limit
  return results.filter((a, i, arr) => arr.findIndex(b => b.value === a.value) === i).slice(0, 20);
}

/** Look for the TOTAL line in OCR text (most reliable amount) */
function findTotalAmount(text: string): number | null {
  const totalKeywords = /\b(total|subtotal|importe|a\s+pagar|monto\s+total|suma|ticket\s+total|amount\s+due)\b/i;
  const lines = text.split(/\n/);
  for (const line of lines) {
    if (totalKeywords.test(line)) {
      const amounts = extractAmounts(line);
      if (amounts.length > 0) return Math.max(...amounts.map(a => a.value));
    }
  }
  return null;
}

// ── AI analysis helpers ────────────────────────────────────────────────────────
function fallbackParse(ocrText: string): ParsedReceipt {
  const amounts = extractAmounts(ocrText);
  const totalAmount = findTotalAmount(ocrText)
    ?? (amounts.length > 0 ? Math.max(...amounts.map(a => a.value)) : null);
  const isuyu = /\$[Uu]|UYU|\bpesos?\b/i.test(ocrText);
  const isusd = /USD|\bd[oó]lares?\b/i.test(ocrText);
  return {
    merchant: null,
    isMultiItem: false,
    items: [],
    description: ocrText.replace(/\s+/g, ' ').trim().slice(0, 60) || null,
    amount: totalAmount,
    currency: isuyu ? 'UYU' : isusd ? 'USD' : 'UYU',
    date: null,
    categoryHint: null,
    paymentMethod: null,
    confidence: 0.2,
  };
}

/** Detect if the receipt is from a supermarket / multi-category store */
function looksLikeMultiItemReceipt(ocrText: string, merchant: string | null): boolean {
  const merchantLower = (merchant ?? '').toLowerCase();
  const supermarketNames = ['disco', 'devoto', 'tienda inglesa', 'géant', 'tata', 'multiahorro', 'super', 'supermercado', 'walmart', 'mercado', 'fresh market', 'carrefour', 'lidl', 'jumbo'];
  if (supermarketNames.some(s => merchantLower.includes(s))) return true;
  // Heuristic: many lines with amounts
  const lineCount = ocrText.split('\n').filter(l => /\d/.test(l)).length;
  return lineCount > 8;
}

async function analyzeWithAI(ocrText: string, imagePath: string | null): Promise<ParsedReceipt> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackParse(ocrText);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: Anthropic } = await import('@anthropic-ai/sdk') as any;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];

    // Attach image if available
    if (imagePath && fs.existsSync(imagePath)) {
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const base64 = fs.readFileSync(imagePath).toString('base64');
      content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } });
    }

    const ocrSnippet = ocrText ? `\n\nTexto OCR detectado:\n${ocrText.slice(0, 2000)}` : '';
    content.push({
      type: 'text',
      text: `Eres un asistente de finanzas personales uruguayo experto en análisis de tickets y comprobantes.${ocrSnippet}

REGLAS NUMÉRICAS URUGUAYAS (CRÍTICO):
- PUNTO = separador de MILES: $1.470 = mil cuatrocientos setenta
- COMA = separador DECIMAL: $1.470,50 = mil cuatrocientos setenta con cincuenta centésimos
- Nunca devolver strings como amount, solo números
- Moneda por defecto: UYU

INSTRUCCIONES:
1. Identificá el comercio (merchant).
2. Determiná si es un ticket de SUPERMERCADO o tienda multi-categoría (más de 4 artículos de categorías distintas).
3. Si es supermercado/multi-categoría → isMultiItem: true y armá el array "items" AGRUPANDO artículos por categoría.
   - Cada item en el array = una categoría del ticket, con su subtotal sumado
   - categoryHint válidos para items de supermercado: food, cleaning, hygiene, snacks, electronics, shopping, health, other
   - Ejemplo: todos los alimentos juntos, todos los artículos de limpieza juntos, etc.
   - El campo "description" de cada item: nombre descriptivo en español, ej: "Alimentos y bebidas", "Limpieza del hogar"
   - Los amounts deben sumar aproximadamente al TOTAL del ticket
4. Si NO es multi-categoría → isMultiItem: false, items: [], y completá los campos simples.
5. Extraer: fecha, moneda, método de pago, confianza.

Respondé ÚNICAMENTE con JSON válido (sin markdown):
{
  "merchant": "string o null",
  "isMultiItem": true/false,
  "items": [
    { "description": "Alimentos y bebidas", "amount": 1250.50, "categoryHint": "food" },
    { "description": "Limpieza del hogar", "amount": 320.00, "categoryHint": "cleaning" }
  ],
  "description": "null si isMultiItem, o descripción corta",
  "amount": null si isMultiItem sino el TOTAL,
  "currency": "UYU",
  "date": "YYYY-MM-DD o null",
  "categoryHint": "null si isMultiItem, sino food/transport/health/shopping/utilities/education/housing/entertainment/other",
  "paymentMethod": "cash/debit/credit/transfer/other/null",
  "confidence": 0.95
}`,
    });

    const resp = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
      messages: [{ role: 'user', content }],
    });

    const raw: string = resp.content?.[0]?.type === 'text' ? resp.content[0].text : '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedReceipt>;
      const base = fallbackParse(ocrText);

      // If AI didn't set isMultiItem but merchant looks like supermarket, override
      const resolvedMulti = parsed.isMultiItem
        ?? looksLikeMultiItemReceipt(ocrText, parsed.merchant ?? null);

      return {
        ...base,
        ...parsed,
        isMultiItem: resolvedMulti,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    }
  } catch (e) {
    console.error('[AI analyze] Error:', e);
  }

  return fallbackParse(ocrText);
}

// ── POST /api/documents/analyze — AI receipt analysis (no DB save) ─────────────
documentRouter.post('/analyze', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
      return;
    }

    const isImage = req.file.mimetype.startsWith('image/');

    // OCR sync
    const ocrText = isImage ? await runOCR(req.file.path) : '';

    // AI analysis
    const result = await analyzeWithAI(ocrText, isImage ? req.file.path : null);

    // Clean up temp file (analysis-only — not stored in DB)
    try { fs.unlinkSync(req.file.path); } catch { /* ok */ }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
documentRouter.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
      return;
    }

    const { prisma } = await import('../lib/prisma');
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';
    const fileUrl = `/uploads/${req.file.filename}`;
    const institution = (req.body.institution as string | undefined) ?? 'other';

    // Create initial document record
    const doc = await prisma.importedDocument.create({
      data: {
        userId: req.userId!,
        filename: req.file.originalname,
        fileUrl,
        type: fileType,
        institution,
        status: 'processing',
      },
    });

    // Run OCR asynchronously (don't block the response)
    (async () => {
      try {
        let extractedData: Record<string, unknown> | null = null;

        if (fileType === 'image') {
          const rawText = await runOCR(req.file!.path);
          const amounts = extractAmounts(rawText);
          extractedData = { rawText: rawText.slice(0, 2000), amounts };
        }

        await prisma.importedDocument.update({
          where: { id: doc.id },
          data: {
            status: 'processed',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extractedData: extractedData as any,
          },
        });
      } catch {
        await prisma.importedDocument.update({
          where: { id: doc.id },
          data: { status: 'error', errorMessage: 'Error al procesar el documento' },
        });
      }
    })();

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents — list uploaded documents ──────────────────────────────
documentRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const docs = await prisma.importedDocument.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents/:id ────────────────────────────────────────────────────
documentRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const { createError } = await import('../middleware/errorHandler');
    const doc = await prisma.importedDocument.findFirst({
      where: { id: req.params['id'], userId: req.userId },
    });
    if (!doc) throw createError('Documento no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────────────────────
documentRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const { createError } = await import('../middleware/errorHandler');
    const doc = await prisma.importedDocument.findFirst({
      where: { id: req.params['id'], userId: req.userId },
    });
    if (!doc) throw createError('Documento no encontrado', 404, 'NOT_FOUND');
    // Remove file from disk
    const filePath = path.join(process.cwd(), doc.fileUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.importedDocument.delete({ where: { id: doc.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
